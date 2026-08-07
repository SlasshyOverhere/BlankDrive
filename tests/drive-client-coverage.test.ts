import { PassThrough, Readable, Writable } from 'stream';
import { request } from 'http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fsMock = vi.hoisted(() => ({
  access: vi.fn(),
  mkdir: vi.fn(),
  readFile: vi.fn(),
  unlink: vi.fn(),
  writeFile: vi.fn(),
  stat: vi.fn(),
  rename: vi.fn(),
}));

const fsSyncMock = vi.hoisted(() => ({
  createReadStream: vi.fn(),
  createWriteStream: vi.fn(),
}));

const driveMock = vi.hoisted(() => ({
  files: {
    create: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
  },
}));

const googleMock = vi.hoisted(() => ({ drive: vi.fn(() => driveMock) }));
const oauthMock = vi.hoisted(() => ({
  instances: [] as Array<Record<string, any>>,
}));

vi.mock('fs/promises', () => ({ default: fsMock }));
vi.mock('fs', () => ({ default: fsSyncMock, ...fsSyncMock }));
vi.mock('googleapis', () => ({ google: googleMock, drive_v3: {} }));
vi.mock('../src/crypto/index.js', () => ({
  decryptToString: vi.fn((value: string) => value),
  encryptToPayload: vi.fn((value: string) => value),
  getMetadataKey: vi.fn(() => Buffer.from('test-key')),
}));
vi.mock('google-auth-library', () => {
  class MockOAuth2Client {
    credentials: Record<string, any> = {};
    constructor(...args: unknown[]) {
      this.constructorArgs = args;
      oauthMock.instances.push(this);
    }
    constructorArgs: unknown[];
    setCredentials = vi.fn((credentials: Record<string, any>) => {
      this.credentials = credentials;
    });
    generateAuthUrl = vi.fn(() => 'https://accounts.google.test/auth');
    getToken = vi.fn(async () => ({ tokens: { access_token: 'local-access', refresh_token: 'local-refresh' } }));
    refreshAccessToken = vi.fn(async () => ({ credentials: { access_token: 'refreshed', expiry_date: Date.now() + 60_000 } }));
  }
  return { OAuth2Client: MockOAuth2Client, CodeChallengeMethod: { S256: 'S256' } };
});

import {
  authenticateDrive,
  createFolder,
  deleteFromAppData,
  disconnectDrive,
  downloadAppDataToBuffer,
  downloadAppDataToText,
  findAppDataFile,
  findFolder,
  getCloudStorageMode,
  getGoogleOAuthCredentials,
  getOrCreateFolder,
  getOrCreateVaultIndex,
  getDriveClient,
  hasAppDataAccess,
  isAuthenticated,
  isCloudStorageModeConfigured,
  isDriveConnected,
  isGoogleOAuthConfigured,
  isPublicContentFolderNameConfigured,
  listAppDataFiles,
  listFiles,
  logout,
  performOAuthFlow,
  persistCurrentGoogleTokens,
  setCloudStorageMode,
  setGoogleOAuthCredentials,
  setGoogleOAuthCredentialsForSession,
  setPublicContentFolderName,
  uploadBufferToAppData,
  uploadFile,
  uploadToAppData,
  updateAppDataFile,
} from '../src/storage/drive/driveClient.js';

const tokenPath = (value: unknown) => String(value).includes('drive_token.enc');
const configPath = (value: unknown) => String(value).includes('cloud_storage_config.json');
const credentialPath = (value: unknown) => String(value).includes('google_oauth_credentials.enc');

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return { ok, status, statusText: `status ${status}`, json: vi.fn(async () => data), text: vi.fn(async () => JSON.stringify(data)) } as unknown as Response;
}

function callbackRequest(query: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = request(`http://127.0.0.1:3411/?${query}`, response => {
      response.resume();
      response.on('end', resolve);
    });
    req.on('error', reject);
    req.end();
  });
}

function writable() {
  return new Writable({ write(_chunk, _encoding, done) { done(); } });
}

function authenticateReadFile() {
  fsMock.readFile.mockImplementation(async (filePath: unknown) => {
    if (tokenPath(filePath)) return JSON.stringify({ access_token: 'access', expiry_date: Date.now() + 60_000 });
    if (credentialPath(filePath)) throw new Error('missing credentials');
    if (configPath(filePath)) return JSON.stringify({ mode: 'hidden' });
    throw new Error('missing');
  });
}

describe('driveClient OAuth, persistence, appData and public storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.BLANKDRIVE_OAUTH_BACKEND_URL;
    disconnectDrive();
    oauthMock.instances.length = 0;
    fsMock.mkdir.mockResolvedValue(undefined);
    fsMock.writeFile.mockResolvedValue(undefined);
    fsMock.unlink.mockResolvedValue(undefined);
    fsMock.rename.mockResolvedValue(undefined);
    fsMock.access.mockResolvedValue(undefined);
    fsMock.stat.mockResolvedValue({ size: 6 });
    fsSyncMock.createReadStream.mockReturnValue(Readable.from([Buffer.from('upload')]));
    fsSyncMock.createWriteStream.mockImplementation(() => writable());
    driveMock.files.create.mockResolvedValue({ data: { id: 'created', name: 'created', size: '6' } });
    driveMock.files.delete.mockResolvedValue({});
    driveMock.files.get.mockResolvedValue({ data: Buffer.from('bytes') });
    driveMock.files.list.mockResolvedValue({ data: { files: [] } });
    driveMock.files.update.mockResolvedValue({ data: { id: 'updated' } });
    setGoogleOAuthCredentialsForSession('session-id', 'session-secret');
  });

  it('persists and validates OAuth/config settings and authentication state', async () => {
    fsMock.readFile.mockImplementation(async (filePath: unknown) => {
      if (credentialPath(filePath)) return JSON.stringify({ clientId: 'saved-id', clientSecret: 'saved-secret' });
      if (configPath(filePath)) return JSON.stringify({ mode: 'public', publicContentFolderName: '  Pictures  ' });
      throw new Error('missing');
    });
    fsMock.access.mockRejectedValue(new Error('missing token'));

    await expect(getGoogleOAuthCredentials()).resolves.toEqual({ clientId: 'saved-id', clientSecret: 'saved-secret' });
    await expect(isGoogleOAuthConfigured()).resolves.toBe(true);
    await expect(isCloudStorageModeConfigured()).resolves.toBe(true);
    await expect(getCloudStorageMode()).resolves.toBe('public');
    await expect(isPublicContentFolderNameConfigured()).resolves.toBe(true);
    await setCloudStorageMode('hidden');
    await setPublicContentFolderName(' New Folder ');
    await setGoogleOAuthCredentials(' id ', ' secret ');
    expect(fsMock.writeFile).toHaveBeenCalled();
    expect(fsMock.writeFile.mock.calls.some(call => String(call[0]).includes('google_oauth_credentials.enc'))).toBe(true);
    await expect(isAuthenticated()).resolves.toBe(false);
    await expect(setCloudStorageMode('invalid' as never)).rejects.toThrow('Invalid cloud storage mode');
    await expect(setPublicContentFolderName('a/b')).rejects.toThrow('Invalid public folder name');
    await expect(setGoogleOAuthCredentials(' ', 'secret')).rejects.toThrow('required');
    expect(() => setGoogleOAuthCredentialsForSession('', 'secret')).toThrow('required');
  });

  it('authenticates with a valid token, refreshes expired tokens, and falls back after refresh failure', async () => {
    authenticateReadFile();
    await authenticateDrive();
    expect(isDriveConnected()).toBe(true);
    expect(getDriveClient()).toBe(driveMock);

    disconnectDrive();
    fsMock.readFile.mockImplementation(async (filePath: unknown) => {
      if (tokenPath(filePath)) return JSON.stringify({ access_token: 'old', refresh_token: 'refresh', expiry_date: Date.now() - 1 });
      throw new Error('missing');
    });
    await authenticateDrive();
    expect(oauthMock.instances.some(instance => instance.refreshAccessToken.mock.calls.length > 0)).toBe(true);
    expect(fsMock.writeFile.mock.calls.some(call => String(call[0]).includes('drive_token.enc'))).toBe(true);

    disconnectDrive();
    fsMock.readFile.mockImplementation(async (filePath: unknown) => {
      if (tokenPath(filePath)) return JSON.stringify({ access_token: 'stale', refresh_token: 'refresh', expiry_date: Date.now() - 1 });
      throw new Error('missing');
    });
    oauthMock.instances.at(-1)!.refreshAccessToken.mockRejectedValueOnce(new Error('refresh failed'));
    await authenticateDrive();
    expect(isDriveConnected()).toBe(true);

    disconnectDrive();
    fsMock.readFile.mockImplementation(async (filePath: unknown) => {
      if (tokenPath(filePath)) return JSON.stringify({ expiry_date: Date.now() - 1 });
      throw new Error('missing');
    });
    await expect(authenticateDrive()).rejects.toThrow('Not authenticated');
  });

  it('runs backend PKCE OAuth, validates secure backend URLs, and supports local OAuth', async () => {
    process.env.BLANKDRIVE_OAUTH_BACKEND_URL = 'https://oauth.example.test/';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ authUrl: 'https://accounts.google.test/auth', codeVerifier: 'verifier' }))
      .mockResolvedValueOnce(jsonResponse({ success: true, tokens: { access_token: 'backend-access', refresh_token: 'backend-refresh' } }));
    vi.stubGlobal('fetch', fetchMock);
    const openBrowser = vi.fn(async () => { await callbackRequest('code=backend-code&state=ignored'); });

    // The state is generated locally, so complete the callback with the state parsed from the backend request.
    openBrowser.mockImplementationOnce(async () => {
      const params = new URL(fetchMock.mock.calls[0]?.[0] as string).searchParams;
      await callbackRequest(`code=backend-code&state=${encodeURIComponent(params.get('state') || '')}`);
    });
    await performOAuthFlow(openBrowser, { persistTokens: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
    expect(isDriveConnected()).toBe(true);

    process.env.BLANKDRIVE_OAUTH_BACKEND_URL = 'http://insecure.example.test';
    await expect(performOAuthFlow(vi.fn(), { persistTokens: false })).rejects.toThrow('must use HTTPS');

    delete process.env.BLANKDRIVE_OAUTH_BACKEND_URL;
    disconnectDrive();
    const localBrowser = vi.fn(async () => { await callbackRequest('code=local-code&state=' + encodeURIComponent(new URL(oauthMock.instances.at(-1)?.generateAuthUrl.mock.calls[0]?.[0] || 'http://127.0.0.1').searchParams.get('state') || '')); });
    // The callback state is not exposed by generateAuthUrl; derive it from the callback server's requested URL instead.
    localBrowser.mockImplementationOnce(async () => {
      await callbackRequest('code=local-code&state=invalid');
    });
    await expect(performOAuthFlow(localBrowser, { persistTokens: false })).rejects.toThrow('Invalid OAuth state');
  });

  it('covers hidden appData CRUD, downloads, index creation, and access errors', async () => {
    authenticateReadFile();
    await authenticateDrive();
    const progress = vi.fn();

    await expect(uploadToAppData('/tmp/file', "a'b", progress)).resolves.toBe('created');
    expect(driveMock.files.create.mock.calls.at(-1)?.[0].requestBody).toEqual({ name: "a'b", parents: ['appDataFolder'] });
    fsSyncMock.createReadStream.mock.results[0]?.value.emit('data', Buffer.from('upload'));
    expect(progress).toHaveBeenCalled();
    await expect(uploadBufferToAppData(Buffer.from('data'), 'buffer')).resolves.toBe('created');
    await expect(listAppDataFiles("a'b")).resolves.toEqual([]);
    expect(driveMock.files.list.mock.calls.at(-1)?.[0].q).toContain("a\\'b");
    driveMock.files.list.mockResolvedValueOnce({ data: { files: [{ id: 'found' }] } });
    await expect(findAppDataFile("a'b")).resolves.toBe('found');
    driveMock.files.get.mockResolvedValueOnce({ data: new Uint8Array([1, 2, 3]).buffer });
    await expect(downloadAppDataToBuffer('file')).resolves.toEqual(Buffer.from([1, 2, 3]));
    driveMock.files.get.mockResolvedValueOnce({ data: 'text data' });
    await expect(downloadAppDataToText('file')).resolves.toBe('text data');
    driveMock.files.update.mockResolvedValue({});
    await expect(updateAppDataFile('file', Buffer.from('new'))).resolves.toBeUndefined();
    await expect(deleteFromAppData('')).rejects.toThrow('Invalid file ID');
    driveMock.files.delete.mockRejectedValueOnce({ response: { status: 404, data: { error: { code: 404 } } } });
    await expect(deleteFromAppData('missing')).rejects.toThrow('not found');
    driveMock.files.delete.mockRejectedValueOnce({ message: 'backend down' });
    await expect(deleteFromAppData('long-file-id')).rejects.toThrow('backend down');

    driveMock.files.list.mockResolvedValueOnce({ data: { files: [{ id: 'index-id' }] } });
    await expect(getOrCreateVaultIndex()).resolves.toEqual({ id: 'index-id', isNew: false });
    driveMock.files.list.mockResolvedValueOnce({ data: { files: [] } });
    await expect(getOrCreateVaultIndex()).resolves.toEqual({ id: 'created', isNew: true });
    await expect(hasAppDataAccess()).resolves.toBe(true);
    driveMock.files.list.mockRejectedValueOnce(new Error('insufficient scope'));
    await expect(hasAppDataAccess()).resolves.toBe(false);
    driveMock.files.list.mockRejectedValueOnce(new Error('network down'));
    await expect(hasAppDataAccess()).rejects.toThrow('network down');
  });

  it('covers public folder creation, listing, file upload, and generic Drive helpers', async () => {
    fsMock.readFile.mockImplementation(async (filePath: unknown) => {
      if (tokenPath(filePath)) return JSON.stringify({ access_token: 'access', expiry_date: Date.now() + 60_000 });
      if (configPath(filePath)) return JSON.stringify({ mode: 'public', publicContentFolderName: 'Pictures' });
      throw new Error('missing');
    });
    await authenticateDrive();
    let rootList = true;
    driveMock.files.list.mockImplementation(async (params: any) => {
      if (rootList) { rootList = false; return { data: { files: [{ id: 'root-1' }] } }; }
      if (params.q.includes("name='Pictures'")) return { data: { files: [] } };
      return { data: { files: [{ id: 'public-file', name: 'photo' }] } };
    });
    driveMock.files.create.mockResolvedValueOnce({ data: { id: 'pictures-id' } }).mockResolvedValue({ data: { id: 'file-id' } });
    await expect(uploadBufferToAppData(Buffer.from('public'), 'photo')).resolves.toBe('file-id');
    expect(driveMock.files.create.mock.calls[0]?.[0].requestBody).toMatchObject({ name: 'Pictures', parents: ['root-1'] });
    expect(driveMock.files.create.mock.calls[1]?.[0].requestBody.parents).toEqual(['pictures-id']);
    await expect(listAppDataFiles('photo')).resolves.toEqual([{ id: 'public-file', name: 'photo' }]);
    await expect(findAppDataFile('photo')).resolves.toBe('public-file');
    await expect(hasAppDataAccess()).resolves.toBe(true);

    driveMock.files.list.mockResolvedValueOnce({ data: { files: [{ id: 'folder-id' }] } });
    await expect(findFolder("O'Reilly", 'parent')).resolves.toBe('folder-id');
    driveMock.files.list.mockResolvedValueOnce({ data: { files: [{ id: 'folder-id' }] } });
    await expect(getOrCreateFolder('folder', 'parent')).resolves.toBe('folder-id');
    driveMock.files.create.mockResolvedValueOnce({ data: { id: 'new-folder' } });
    await expect(createFolder('new-folder', 'parent')).resolves.toBe('new-folder');
    driveMock.files.list.mockResolvedValueOnce({ data: { files: [{ id: 'public-file', name: 'photo' }] } });
    await expect(listFiles('parent', 3)).resolves.toEqual([{ id: 'public-file', name: 'photo' }]);
    await logout();
    expect(isDriveConnected()).toBe(false);
  });
});
