import { PassThrough, Readable, Writable } from 'node:stream';
import { request } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  unlink: vi.fn(),
  stat: vi.fn(),
  rename: vi.fn(),
}));
const fsSync = vi.hoisted(() => ({
  createReadStream: vi.fn(),
  createWriteStream: vi.fn(),
}));
const drive = vi.hoisted(() => ({
  files: {
    create: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
  },
}));
const oauth = vi.hoisted(() => ({ instances: [] as any[] }));

vi.mock('fs/promises', () => ({ default: fs }));
vi.mock('fs', () => ({ default: fsSync, ...fsSync }));
vi.mock('googleapis', () => ({ google: { drive: vi.fn(() => drive) }, drive_v3: {} }));
vi.mock('../src/crypto/index.js', () => ({
  decryptToString: vi.fn((value: string) => value),
  encryptToPayload: vi.fn((value: string) => value),
  getMetadataKey: vi.fn(() => Buffer.from('key')),
}));
vi.mock('google-auth-library', () => {
  class OAuth2Client {
    credentials: Record<string, any> = {};
    constructor(...args: unknown[]) { this.args = args; oauth.instances.push(this); }
    args: unknown[];
    setCredentials = vi.fn((value: Record<string, any>) => { this.credentials = value; });
    generateAuthUrl = vi.fn((value: unknown) => { this.authOptions = value; return 'https://accounts.test/auth'; });
    authOptions: unknown;
    getToken = vi.fn(async () => ({ tokens: { access_token: 'local-access' } }));
    refreshAccessToken = vi.fn(async () => ({ credentials: { access_token: 'refreshed' } }));
  }
  return { OAuth2Client, CodeChallengeMethod: { S256: 'S256' } };
});

import {
  authenticateDrive,
  createFolder,
  deleteFile,
  disconnectDrive,
  downloadFile,
  downloadFromAppData,
  findFolder,
  getCloudStorageMode,
  getDriveClient,
  listAppDataFiles,
  listFiles,
  logout,
  performOAuthFlow,
  persistCurrentGoogleTokens,
  setCloudStorageMode,
  setGoogleOAuthCredentialsForSession,
  setPublicContentFolderName,
  uploadBufferToAppData,
  uploadFile,
  uploadToAppData,
} from '../src/storage/drive/driveClient.js';

const tokenPath = (value: unknown) => String(value).includes('drive_token.enc');
const configPath = (value: unknown) => String(value).includes('cloud_storage_config.json');
const writable = () => new Writable({ write(_chunk, _encoding, done) { done(); } });

function callback(query: string, pathname = '/'): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request(`http://127.0.0.1:3411${pathname}?${query}`, response => {
      response.resume();
      response.on('end', () => resolve(response.statusCode ?? 0));
    });
    req.on('error', reject);
    req.end();
  });
}

async function authenticate(mode: 'hidden' | 'public' = 'hidden'): Promise<void> {
  fs.readFile.mockImplementation(async (filePath: unknown) => {
    if (tokenPath(filePath)) return JSON.stringify({ access_token: 'access', expiry_date: Date.now() + 60_000 });
    if (configPath(filePath)) return JSON.stringify({ mode, publicContentFolderName: 'Pictures' });
    throw new Error('missing');
  });
  await authenticateDrive();
}

describe('remaining drive client error and helper paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.BLANKDRIVE_OAUTH_BACKEND_URL;
    oauth.instances.length = 0;
    disconnectDrive();
    setGoogleOAuthCredentialsForSession('client', 'secret');
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);
    fs.unlink.mockResolvedValue(undefined);
    fs.rename.mockResolvedValue(undefined);
    fs.stat.mockResolvedValue({ size: 4 });
    fsSync.createReadStream.mockReturnValue(Readable.from([Buffer.from('data')]));
    fsSync.createWriteStream.mockImplementation(() => writable());
    drive.files.create.mockResolvedValue({ data: { id: 'created' } });
    drive.files.delete.mockResolvedValue({});
    drive.files.update.mockResolvedValue({});
    drive.files.list.mockResolvedValue({ data: { files: [] } });
    drive.files.get.mockResolvedValue({ data: Buffer.from('data') });
  });

  it('validates empty folder names and persists the active OAuth session', async () => {
    await expect(setPublicContentFolderName('   ')).rejects.toThrow('Invalid public folder name');
    await expect(persistCurrentGoogleTokens()).rejects.toThrow('No authenticated Google session');
    await authenticate();
    await expect(persistCurrentGoogleTokens()).resolves.toBeUndefined();
    expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining('drive_token.enc'), expect.anything(), expect.anything());
    expect(getDriveClient()).toBeTruthy();
  });

  it('covers generic Drive upload, list, folder, and response-id errors', async () => {
    await authenticate();
    drive.files.create.mockResolvedValueOnce({ data: {} });
    await expect(uploadFile('/tmp/file', 'photo', 'image/png', 'folder')).rejects.toThrow('no ID returned');
    drive.files.create.mockResolvedValueOnce({ data: { id: 'upload-id' } });
    await expect(uploadFile('/tmp/file', 'photo', 'image/png', 'folder')).resolves.toBe('upload-id');
    expect(drive.files.create.mock.calls.at(-1)?.[0].requestBody.parents).toEqual(['folder']);
    await expect(deleteFile('file-id')).resolves.toBeUndefined();
    drive.files.create.mockResolvedValueOnce({ data: {} });
    await expect(createFolder('folder')).rejects.toThrow('no ID returned');
    drive.files.list.mockResolvedValueOnce({ data: { files: [{ name: 'no-id' }] } });
    await expect(findFolder('folder')).resolves.toBeNull();
    drive.files.list.mockResolvedValueOnce({ data: {} });
    await expect(listFiles()).resolves.toEqual([]);
  });

  it('covers hidden-mode missing results and upload response errors', async () => {
    await authenticate();
    drive.files.create.mockResolvedValueOnce({ data: {} });
    await expect(uploadToAppData('/tmp/file', 'file')).rejects.toThrow('no ID returned');
    drive.files.create.mockResolvedValueOnce({ data: {} });
    await expect(uploadBufferToAppData(Buffer.from('x'), 'file')).rejects.toThrow('no ID returned');
    drive.files.list.mockResolvedValueOnce({ data: {} });
    await expect(listAppDataFiles()).resolves.toEqual([]);
    drive.files.list.mockResolvedValueOnce({ data: { files: [{ name: 'missing-id' }] } });
    const { findAppDataFile } = await import('../src/storage/drive/driveClient.js');
    await expect(findAppDataFile('file')).resolves.toBeNull();
    await expect(getCloudStorageMode()).resolves.toBe('hidden');
  });

  it('handles public root duplicates, failed consolidation, and missing content configuration', async () => {
    await authenticate('public');
    drive.files.list
      .mockResolvedValueOnce({ data: { files: [{ id: 'root' }, { id: 'duplicate' }, {}] } })
      .mockResolvedValueOnce({ data: { files: [{ id: 'child' }, {}] } })
      .mockResolvedValueOnce({ data: { files: [] } });
    drive.files.delete.mockRejectedValueOnce(new Error('cannot delete duplicate'));
    drive.files.create.mockResolvedValueOnce({ data: { id: 'content' } });
    await expect(listAppDataFiles("O'Reilly")).resolves.toEqual([]);
    expect(drive.files.update).toHaveBeenCalledWith(expect.objectContaining({ fileId: 'child', addParents: 'root', removeParents: 'duplicate' }));

    disconnectDrive();
    fs.readFile.mockImplementation(async (filePath: unknown) => {
      if (tokenPath(filePath)) return JSON.stringify({ access_token: 'access', expiry_date: Date.now() + 60_000 });
      if (configPath(filePath)) return JSON.stringify({ mode: 'public' });
      throw new Error('missing');
    });
    await authenticateDrive();
    drive.files.list.mockResolvedValue({ data: { files: [] } });
    drive.files.create.mockResolvedValue({ data: { id: 'root-created' } });
    await expect(listAppDataFiles()).rejects.toThrow('not configured');
  });

  it('exercises OAuth callback error pages, non-root callback, and no-token completion', async () => {
    const open = vi.fn(async () => {
      await callback('', '/wrong');
      const state = (oauth.instances.at(-1)?.authOptions as any)?.state;
      await callback(`error=${encodeURIComponent('denied')}&state=${encodeURIComponent(state)}`);
    });
    await expect(performOAuthFlow(open, { persistTokens: false })).rejects.toThrow('Google OAuth error: denied');

    const success = vi.fn(async () => {
      const state = (oauth.instances.at(-1)?.authOptions as any)?.state;
      await callback(`code=code&state=${encodeURIComponent(state)}`);
      oauth.instances.at(-1)?.getToken.mockResolvedValueOnce({ tokens: {} });
    });
    await expect(performOAuthFlow(success, { persistTokens: false })).rejects.toThrow('no tokens were returned');
  });

  it('downloads files and cleans temporary files on stream, destination, and rename errors', async () => {
    await authenticate();
    const source = new PassThrough();
    const destination = new Writable({ write(_chunk, _encoding, done) { done(); } });
    fsSync.createWriteStream.mockReturnValue(destination);
    drive.files.get
      .mockResolvedValueOnce({ data: { size: '4' } })
      .mockResolvedValueOnce({ data: source });
    const progress = vi.fn();
    const success = downloadFromAppData('id', '/tmp/out', progress);
    source.end(Buffer.from('data'));
    await expect(success).resolves.toBeUndefined();
    expect(progress).toHaveBeenCalled();

    const sourceError = new PassThrough();
    fsSync.createWriteStream.mockReturnValue(new Writable({ write(_chunk, _encoding, done) { done(); } }));
    drive.files.get.mockResolvedValueOnce({ data: sourceError });
    const failedStream = downloadFromAppData('id', '/tmp/out');
    await new Promise<void>((resolve) => setImmediate(resolve));
    sourceError.emit('error', new Error('stream failed'));
    await expect(failedStream).rejects.toThrow('stream failed');
    expect(fs.unlink).toHaveBeenCalled();

    const destinationError = new Writable({ write(_chunk, _encoding, done) { done(); } });
    const source2 = new PassThrough();
    fsSync.createWriteStream.mockReturnValue(destinationError);
    drive.files.get.mockResolvedValueOnce({ data: source2 });
    const failedDestination = downloadFromAppData('id', '/tmp/out');
    await new Promise<void>((resolve) => setImmediate(resolve));
    destinationError.emit('error', new Error('destination failed'));
    await expect(failedDestination).rejects.toThrow('destination failed');

    const source3 = new PassThrough();
    const destination3 = new PassThrough();
    fsSync.createWriteStream.mockReturnValue(destination3);
    fs.rename.mockRejectedValueOnce(new Error('rename failed'));
    drive.files.get.mockResolvedValueOnce({ data: source3 });
    const failedRename = downloadFromAppData('id', '/tmp/out');
    source3.end(Buffer.from('data'));
    await expect(failedRename).rejects.toThrow('rename failed');
  });

  it('downloads ordinary Drive streams and propagates stream errors', async () => {
    await authenticate();
    const source = new PassThrough();
    const destination = new Writable({ write(_chunk, _encoding, done) { done(); } });
    fsSync.createWriteStream.mockReturnValue(destination);
    drive.files.get.mockResolvedValueOnce({ data: source });
    const result = downloadFile('id', '/tmp/out');
    source.end(Buffer.from('data'));
    await expect(result).resolves.toBeUndefined();

    const broken = new PassThrough();
    drive.files.get.mockResolvedValueOnce({ data: broken });
    const failed = downloadFile('id', '/tmp/out');
    await new Promise<void>((resolve) => setImmediate(resolve));
    broken.emit('error', new Error('download failed'));
    await expect(failed).rejects.toThrow('download failed');
    await logout();
  });
});
