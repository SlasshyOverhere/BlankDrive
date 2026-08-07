import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  fs: { readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn(), access: vi.fn(), unlink: vi.fn() },
  crypto: { encryptToPayload: vi.fn((value: string) => value), decryptToString: vi.fn((value: string) => value), getMetadataKey: vi.fn(() => Buffer.from('metadata')), randomHex: vi.fn(() => 'encryption-key') },
}));
vi.mock('fs/promises', () => ({ default: state.fs }));
vi.mock('fs', () => ({ default: { createReadStream: vi.fn(() => ({ stream: true })) } }));
vi.mock('../src/crypto/index.js', () => state.crypto);
vi.mock('crypto-js', () => ({ default: { AES: { decrypt: vi.fn(() => ({ toString: () => JSON.stringify({ access_token: 'decrypted-access', refresh_token: 'decrypted-refresh', expires_in: 3600 }) })) }, enc: { Utf8: 'utf8' } } }));
import * as onedrive from '../src/storage/onedrive/onedriveClient.js';

const tokens = { access_token: 'access', refresh_token: 'refresh', expires_in: 3600, expiry_date: Date.now() + 3_600_000 };
const response = (json: unknown, init: Partial<Response> = {}) => ({ ok: true, status: 200, statusText: 'OK', json: vi.fn(async () => json), arrayBuffer: vi.fn(async () => Uint8Array.from([1, 2, 3]).buffer), ...init });

describe('OneDrive remaining direct branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onedrive.disconnectOneDrive();
    state.fs.readFile.mockRejectedValue(new Error('missing'));
    state.fs.writeFile.mockResolvedValue(undefined);
    state.fs.mkdir.mockResolvedValue(undefined);
    state.fs.access.mockRejectedValue(new Error('missing'));
    state.fs.unlink.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn());
  });

  async function authenticated(): Promise<void> {
    state.fs.readFile.mockResolvedValue(JSON.stringify(tokens));
    await onedrive.initializeOneDrive();
  }

  it('rejects unsafe auth URLs and handles refresh failures and encrypted tokens', async () => {
    state.fs.readFile.mockResolvedValue(JSON.stringify({ serverUrl: 'https://oauth.test' }));
    vi.mocked(fetch).mockResolvedValue(response({ authUrl: 'http://login.microsoftonline.com/callback', sessionId: 's' }) as Response);
    await expect(onedrive.startOneDriveOAuthFlow()).rejects.toThrow('protocol');
    vi.mocked(fetch).mockResolvedValue(response({ authUrl: 'https://evil.example/callback', sessionId: 's' }) as Response);
    await expect(onedrive.startOneDriveOAuthFlow()).rejects.toThrow('Unexpected OneDrive');

    state.fs.readFile.mockImplementation(async (file: string) => file.includes('config') ? JSON.stringify({ serverUrl: 'https://oauth.test' }) : JSON.stringify({ ...tokens, expiry_date: 0 }));
    vi.mocked(fetch).mockResolvedValue(response({}, { ok: false, status: 503, statusText: 'Unavailable' }) as Response);
    await expect(onedrive.initializeOneDrive()).rejects.toThrow('authentication expired');

    state.fs.readFile.mockResolvedValue(JSON.stringify({ serverUrl: 'https://oauth.test' }));
    vi.mocked(fetch).mockResolvedValue(response({ encrypted: true, tokens: 'ciphertext' }) as Response);
    await authenticated();
    expect(onedrive.isOneDriveConnected()).toBe(true);
  });

  it('covers OAuth statuses, full flow, and secure polling headers', async () => {
    await expect(onedrive.startOneDriveOAuthFlow()).rejects.toThrow('not configured');
    state.fs.readFile.mockResolvedValue(JSON.stringify({ serverUrl: 'https://oauth.test' }));
    vi.mocked(fetch).mockResolvedValue(response({}, { ok: false, status: 500, statusText: 'bad' }) as Response);
    await expect(onedrive.startOneDriveOAuthFlow()).rejects.toThrow('OAuth server error: bad');

    vi.mocked(fetch).mockResolvedValue(response({}, { ok: false, status: 400, statusText: 'bad' }) as Response);
    await expect(onedrive.pollForOneDriveTokens('session id', 'secret', 1, 0)).rejects.toThrow('secure token polling');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/onedrive/poll/session%20id'), expect.objectContaining({ headers: { 'x-blankdrive-encryption-key': 'secret' } }));
    vi.mocked(fetch).mockResolvedValue(response({ status: 'error', error: 'denied' }) as Response);
    await expect(onedrive.pollForOneDriveTokens('s', 'k', 1, 0)).rejects.toThrow('denied');
    vi.mocked(fetch).mockResolvedValue(response({ status: 'pending' }) as Response);
    await expect(onedrive.pollForOneDriveTokens('s', 'k', 1, 0)).rejects.toThrow('timeout');

    vi.mocked(fetch).mockResolvedValue(response({ status: 'complete', encrypted: true, tokens: 'ciphertext' }) as Response);
    await expect(onedrive.performOneDriveOAuthFlow(async (url) => expect(url).toContain('microsoftonline.com'))).rejects.toThrow();
  });

  it('covers visible/app folder CRUD, pagination filters, and index creation', async () => {
    await authenticated();
    const f = vi.mocked(fetch);
    f.mockResolvedValueOnce(response({}, { ok: false, status: 404, statusText: 'missing' }) as Response).mockResolvedValueOnce(response({ id: 'folder' }) as Response);
    await expect(onedrive.getOrCreateSlasshyFolder()).resolves.toBe('folder');
    f.mockResolvedValue(response({ id: 'upload-id' }) as Response);
    await expect(onedrive.uploadToOneDrive('/tmp/input', 'file.bin', 'folder')).resolves.toBe('upload-id');
    await expect(onedrive.uploadBufferToOneDrive(Buffer.from('x'), 'file.bin')).resolves.toBe('upload-id');
    state.fs.readFile.mockResolvedValue(Buffer.from('file'));
    await expect(onedrive.uploadToOneDriveAppFolder('/tmp/input', 'file.bin')).resolves.toBe('upload-id');
    await onedrive.updateOneDriveAppFolderFile('id', Buffer.from('x'));

    f.mockResolvedValue(response({ value: [{ id: 'i', name: 'file' }] }) as Response);
    await expect(onedrive.listOneDriveFiles('folder', 'name eq \'file\'')).resolves.toHaveLength(1);
    await expect(onedrive.listOneDriveAppFolderFiles('file')).resolves.toHaveLength(1);
    await expect(onedrive.findOneDriveAppFolderFile('file')).resolves.toBe('i');
    f.mockResolvedValue(response({ id: 'id', '@microsoft.graph.downloadUrl': 'https://download.test' }) as Response);
    await expect(onedrive.downloadOneDriveToBuffer('id')).resolves.toEqual(Buffer.from([1, 2, 3]));
    await onedrive.downloadFromOneDrive('id', '/tmp/out');
    await onedrive.downloadFromOneDriveAppFolder('id', '/tmp/out');
    await onedrive.downloadOneDriveAppFolderToBuffer('id');
    f.mockResolvedValue(response({ value: [] }) as Response).mockResolvedValueOnce(response({ value: [] }) as Response).mockResolvedValueOnce(response({ id: 'new' }) as Response);
    await expect(onedrive.getOrCreateOneDriveVaultIndex()).resolves.toEqual({ id: 'new', isNew: true });
    await onedrive.deleteFromOneDrive('id');
    await onedrive.deleteFromOneDriveAppFolder('id');
  });

  it('covers missing download URL, app-folder errors, user/quota defaults, and API failures', async () => {
    await authenticated();
    const f = vi.mocked(fetch);
    f.mockResolvedValue(response({ id: 'id' }) as Response);
    await expect(onedrive.downloadOneDriveToBuffer('id')).rejects.toThrow('No download URL');
    f.mockResolvedValue(response({}, { ok: false, status: 500, statusText: 'bad' }) as Response);
    await expect(onedrive.listOneDriveAppFolderFiles()).resolves.toEqual([]);
    await expect(onedrive.hasOneDriveAppFolderAccess()).resolves.toBe(false);
    f.mockResolvedValue(response({ displayName: 'Name', mail: '', userPrincipalName: 'principal' }) as Response);
    await expect(onedrive.getOneDriveUserInfo()).resolves.toEqual({ name: 'Name', email: 'principal' });
    f.mockResolvedValue(response({ quota: { used: 1, total: 2, remaining: 1 } }) as Response);
    await expect(onedrive.getOneDriveQuota()).resolves.toEqual({ used: 1, total: 2, remaining: 1 });
    f.mockResolvedValue(response({}, { ok: false, status: 500, statusText: 'bad' }) as Response);
    await expect(onedrive.getOneDriveUserInfo()).rejects.toThrow('Graph API error');
  });
});
