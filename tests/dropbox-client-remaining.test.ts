import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  fs: { readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn(), access: vi.fn(), unlink: vi.fn() },
  crypto: { encryptToPayload: vi.fn((value: string) => value), decryptToString: vi.fn((value: string) => value), getMetadataKey: vi.fn(() => Buffer.from('metadata')), randomHex: vi.fn(() => 'encryption-key') },
}));
vi.mock('fs/promises', () => ({ default: state.fs }));
vi.mock('fs', () => ({ default: { createReadStream: vi.fn(() => ({ stream: true })) } }));
vi.mock('../src/crypto/index.js', () => state.crypto);
vi.mock('crypto-js', () => ({ default: { AES: { decrypt: vi.fn(() => ({ toString: () => JSON.stringify({ access_token: 'decrypted-access', refresh_token: 'decrypted-refresh', expires_in: 3600 }) })) }, enc: { Utf8: 'utf8' } } }));
import * as dropbox from '../src/storage/dropbox/dropboxClient.js';

const tokens = { access_token: 'access', refresh_token: 'refresh', expires_in: 3600, expiry_date: Date.now() + 3_600_000 };
const response = (json: unknown, init: Partial<Response> = {}) => ({ ok: true, status: 200, statusText: 'OK', json: vi.fn(async () => json), arrayBuffer: vi.fn(async () => Uint8Array.from([1, 2, 3]).buffer), ...init });

describe('Dropbox remaining direct branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dropbox.disconnectDropbox();
    state.fs.readFile.mockRejectedValue(new Error('missing'));
    state.fs.writeFile.mockResolvedValue(undefined);
    state.fs.mkdir.mockResolvedValue(undefined);
    state.fs.access.mockRejectedValue(new Error('missing'));
    state.fs.unlink.mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn());
  });

  async function authenticated(): Promise<void> {
    state.fs.readFile.mockResolvedValue(JSON.stringify(tokens));
    await dropbox.initializeDropbox();
  }

  it('rejects unsafe auth URLs and handles refresh failures and encrypted tokens', async () => {
    state.fs.readFile.mockResolvedValue(JSON.stringify({ serverUrl: 'https://oauth.test' }));
    vi.mocked(fetch).mockResolvedValue(response({ authUrl: 'http://www.dropbox.com/callback', sessionId: 's' }) as Response);
    await expect(dropbox.startDropboxOAuthFlow()).rejects.toThrow('protocol');
    vi.mocked(fetch).mockResolvedValue(response({ authUrl: 'https://evil.example/callback', sessionId: 's' }) as Response);
    await expect(dropbox.startDropboxOAuthFlow()).rejects.toThrow('Unexpected Dropbox');

    state.fs.readFile.mockImplementation(async (file: string) => file.includes('config') ? JSON.stringify({ serverUrl: 'https://oauth.test' }) : JSON.stringify({ ...tokens, expiry_date: 0 }));
    vi.mocked(fetch).mockResolvedValue(response({}, { ok: false, status: 503, statusText: 'Unavailable' }) as Response);
    await expect(dropbox.initializeDropbox()).rejects.toThrow('authentication expired');

    state.fs.readFile.mockResolvedValue(JSON.stringify({ serverUrl: 'https://oauth.test' }));
    vi.mocked(fetch).mockResolvedValue(response({ encrypted: true, tokens: 'ciphertext' }) as Response);
    await authenticated();
    expect(dropbox.isDropboxConnected()).toBe(true);
  });

  it('covers OAuth status/error/timeout paths and full flow', async () => {
    await expect(dropbox.startDropboxOAuthFlow()).rejects.toThrow('not configured');
    state.fs.readFile.mockResolvedValue(JSON.stringify({ serverUrl: 'https://oauth.test' }));
    vi.mocked(fetch).mockResolvedValue(response({}, { ok: false, status: 500, statusText: 'bad' }) as Response);
    await expect(dropbox.startDropboxOAuthFlow()).rejects.toThrow('OAuth server error: bad');

    vi.mocked(fetch).mockResolvedValue(response({}, { ok: false, status: 400, statusText: 'bad' }) as Response);
    await expect(dropbox.pollForDropboxTokens('session id', 'secret', 1, 0)).rejects.toThrow('secure token polling');
    vi.mocked(fetch).mockResolvedValue(response({ status: 'error' }) as Response);
    await expect(dropbox.pollForDropboxTokens('s', 'k', 1, 0)).rejects.toThrow('OAuth authorization failed');
    vi.mocked(fetch).mockResolvedValue(response({ status: 'not_found' }) as Response);
    await expect(dropbox.pollForDropboxTokens('s', 'k', 1, 0)).rejects.toThrow('Session expired');
    vi.mocked(fetch).mockResolvedValue(response({ status: 'pending' }) as Response);
    await expect(dropbox.pollForDropboxTokens('s', 'k', 1, 0)).rejects.toThrow('timeout');

    vi.mocked(fetch).mockResolvedValue(response({ status: 'complete', encrypted: true, tokens: 'ciphertext' }) as Response);
    await expect(dropbox.performDropboxOAuthFlow(async (url) => expect(url).toContain('dropbox.com'))).rejects.toThrow();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/dropbox/start'))).toBe(true);
  });

  it('covers app-folder creation, file download, pagination, and index creation', async () => {
    await authenticated();
    const f = vi.mocked(fetch);
    f.mockResolvedValueOnce(response({}, { ok: false, status: 409, statusText: 'missing' }) as Response).mockResolvedValueOnce(response({}) as Response);
    await dropbox.ensureAppFolder();
    expect(f).toHaveBeenCalledTimes(2);

    f.mockResolvedValue(response({ id: 'upload-id' }) as Response);
    await expect(dropbox.uploadToDropbox('/tmp/input', 'file.bin', '/folder')).resolves.toBe('upload-id');
    await expect(dropbox.downloadDropboxToBuffer('/folder/file.bin')).resolves.toEqual(Buffer.from([1, 2, 3]));
    await dropbox.downloadFromDropbox('/folder/file.bin', '/tmp/output');
    expect(state.fs.writeFile).toHaveBeenCalledWith('/tmp/output', expect.any(Buffer));

    f.mockResolvedValueOnce(response({ entries: [{ '.tag': 'file', name: 'one', path_lower: '/one' }, { '.tag': 'folder', name: 'dir' }], cursor: 'c1', has_more: true }) as Response).mockResolvedValueOnce(response({ entries: [{ '.tag': 'file', name: 'two', path_lower: '/two' }], cursor: 'c2', has_more: false }) as Response);
    await expect(dropbox.listDropboxFiles('/folder')).resolves.toHaveLength(2);

    f.mockResolvedValueOnce(response({ entries: [], cursor: '', has_more: false }) as Response).mockResolvedValueOnce(response({}, { ok: false, status: 500, statusText: 'bad' }) as Response).mockResolvedValueOnce(response({}) as Response).mockResolvedValueOnce(response({ id: 'index-id' }) as Response);
    await expect(dropbox.getOrCreateDropboxVaultIndex()).resolves.toEqual({ path: '/SlasshyVault/slasshy_vault_index.json', isNew: true });
  });

  it('covers API errors, missing folders, quota defaults, and expired authentication', async () => {
    await authenticated();
    const f = vi.mocked(fetch);
    f.mockResolvedValue(response({}, { ok: false, status: 500, statusText: 'bad' }) as Response);
    await expect(dropbox.getDropboxUserInfo()).rejects.toThrow('Dropbox API error');
    f.mockResolvedValue(response({ entries: [] }, { ok: false, status: 404, statusText: 'not found' }) as Response);
    await expect(dropbox.listDropboxFiles()).resolves.toEqual([]);
    f.mockResolvedValue(response({ used: 7, allocation: {} }) as Response);
    await expect(dropbox.getDropboxQuota()).resolves.toEqual({ used: 7, allocated: 0 });
    f.mockResolvedValue(response({ entries: [{ '.tag': 'file', name: 'slasshy_vault_index.json', path_lower: '/existing' }], cursor: '', has_more: false }) as Response);
    await expect(dropbox.getOrCreateDropboxVaultIndex()).resolves.toEqual({ path: '/existing', isNew: false });
    dropbox.disconnectDropbox();
    await expect(dropbox.downloadDropboxToBuffer('/x')).rejects.toThrow('authentication expired');
  });
});
