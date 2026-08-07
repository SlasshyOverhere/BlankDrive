import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state = {
    exists: true,
    unlocked: true,
    twoFa: undefined as { enabled: boolean; secret: string; backupCodes?: string[] } | undefined,
    entries: {} as Record<string, any>,
    index: {} as Record<string, any>,
    fileData: Buffer.from('abcdef'),
    missingFileData: false,
    fileError: 'missing chunk',
    cloudAvailable: true,
    cloudRestored: false,
    uploadFiles: new Map<string, Buffer>(),
    uploadCounter: 0,
    nextEntry: 0,
  };

  const vault = {
    initVault: vi.fn(), vaultExists: vi.fn(), isUnlocked: vi.fn(), getStats: vi.fn(),
    getVaultPaths: vi.fn(), getVault2FAConfig: vi.fn(), addEntry: vi.fn(), addNoteEntry: vi.fn(),
    addFileEntry: vi.fn(), deleteEntry: vi.fn(), getEntry: vi.fn(), getFileData: vi.fn(),
    getFileEntry: vi.fn(), getNoteEntry: vi.fn(), getVaultIndex: vi.fn(), listEntries: vi.fn(),
    lock: vi.fn(), toggleFavorite: vi.fn(), unlock: vi.fn(), updateEntry: vi.fn(),
    updateNoteEntry: vi.fn(), useBackupCode: vi.fn(),
  };
  const cloud = { downloadFileFromCloud: vi.fn(), isCloudSyncAvailable: vi.fn() };
  const twoFa = { verifyBackupCode: vi.fn(), verifyVault2FACode: vi.fn() };
  const fs = {
    readFile: vi.fn(), mkdtemp: vi.fn(), writeFile: vi.fn(), appendFile: vi.fn(),
    unlink: vi.fn(), rm: vi.fn(), access: vi.fn(),
  };
  const child = { execFile: vi.fn() };

  return { state, vault, cloud, twoFa, fs, child };
});

vi.mock('../src/storage/vault/index.js', () => mocks.vault);
vi.mock('../src/storage/drive/index.js', () => mocks.cloud);
vi.mock('../src/cli/vault2fa.js', () => mocks.twoFa);
vi.mock('node:fs/promises', () => ({ default: mocks.fs }));
vi.mock('node:child_process', () => ({ execFile: mocks.child.execFile }));

import { startWebUiServer } from '../src/webui/server.js';

type Handle = Awaited<ReturnType<typeof startWebUiServer>>;

const passwordEntry = () => ({
  id: 'p1', type: 'password', title: 'Password', username: 'alice', password: 'secret',
  url: 'https://example.test', notes: 'notes', category: 'work', favorite: false,
  created: 1, modified: 2,
});
const noteEntry = () => ({
  id: 'n1', type: 'note', title: 'Note', content: 'private note', favorite: false,
  created: 1, modified: 2,
});
const fileEntry = () => ({
  id: 'f1', type: 'file', title: 'File', originalName: '../clip.html', mimeType: 'text/html',
  size: 6, checksum: 'hash', favorite: false, created: 1, modified: 2,
});

function resetState(): void {
  const s = mocks.state;
  s.exists = true;
  s.unlocked = true;
  s.twoFa = undefined;
  s.entries = { p1: passwordEntry(), n1: noteEntry(), f1: fileEntry() };
  s.index = {
    p1: { entryType: 'password' }, n1: { entryType: 'note' },
    f1: { entryType: 'file', cloudChunks: [{ chunkIndex: 0, driveFileId: 'cloud-1', size: 6 }] },
  };
  s.fileData = Buffer.from('abcdef');
  s.missingFileData = false;
  s.fileError = 'missing chunk';
  s.cloudAvailable = true;
  s.cloudRestored = false;
  s.uploadFiles.clear();
  s.uploadCounter = 0;
  s.nextEntry = 0;

  vi.clearAllMocks();
  mocks.vault.vaultExists.mockImplementation(async () => mocks.state.exists);
  mocks.vault.isUnlocked.mockImplementation(() => s.unlocked);
  mocks.vault.getStats.mockImplementation(() => ({ entryCount: Object.keys(s.entries).length, created: 1 }));
  mocks.vault.getVaultPaths.mockReturnValue({ dir: '/tmp/test-vault' });
  mocks.vault.getVault2FAConfig.mockImplementation(() => s.twoFa);
  mocks.vault.getVaultIndex.mockImplementation(() => ({ entries: s.index }));
  mocks.vault.listEntries.mockImplementation(async () => Object.values(s.entries));
  mocks.vault.getEntry.mockImplementation(async (id: string) => s.entries[id]?.type === 'password' ? s.entries[id] : null);
  mocks.vault.getNoteEntry.mockImplementation(async (id: string) => s.entries[id]?.type === 'note' ? s.entries[id] : null);
  mocks.vault.getFileEntry.mockImplementation(async (id: string) => s.entries[id]?.type === 'file' ? s.entries[id] : null);
  mocks.vault.getFileData.mockImplementation(async () => {
    if (s.missingFileData && !s.cloudRestored) throw new Error(s.fileError);
    return s.fileData;
  });
  mocks.vault.initVault.mockImplementation(async () => { s.exists = true; s.unlocked = true; });
  mocks.vault.unlock.mockImplementation(async (password: string) => {
    if (password === 'bad') throw new Error('Decryption failed: invalid key');
    s.unlocked = true;
  });
  mocks.vault.lock.mockImplementation(() => { s.unlocked = false; });
  mocks.vault.useBackupCode.mockResolvedValue(undefined);
  mocks.vault.addEntry.mockImplementation(async (title: string, data: any) => {
    const id = `p${++s.nextEntry + 1}`;
    const entry = { id, type: 'password', title, ...data, favorite: false, created: 1, modified: 2 };
    s.entries[id] = entry; s.index[id] = { entryType: 'password' }; return entry;
  });
  mocks.vault.addNoteEntry.mockImplementation(async (title: string, content: string, favorite = false) => {
    const id = `n${++s.nextEntry + 1}`;
    const entry = { id, type: 'note', title, content, favorite, created: 1, modified: 2 };
    s.entries[id] = entry; s.index[id] = { entryType: 'note' }; return entry;
  });
  mocks.vault.addFileEntry.mockImplementation(async (title: string, filePath: string, notes?: string) => {
    const id = `f${++s.nextEntry + 1}`;
    const data = s.uploadFiles.get(filePath) ?? Buffer.alloc(0);
    const entry = { id, type: 'file', title, originalName: filePath.split('/').pop(), mimeType: 'text/plain', size: data.length, checksum: 'upload', notes, favorite: false, created: 1, modified: 2 };
    s.entries[id] = entry; s.index[id] = { entryType: 'file' }; s.fileData = data; return entry;
  });
  mocks.vault.updateEntry.mockImplementation(async (id: string, updates: any) => {
    if (!s.entries[id] || s.entries[id].type !== 'password') return null;
    s.entries[id] = { ...s.entries[id], ...updates }; return s.entries[id];
  });
  mocks.vault.updateNoteEntry.mockImplementation(async (id: string, updates: any) => {
    if (!s.entries[id] || s.entries[id].type !== 'note') return null;
    s.entries[id] = { ...s.entries[id], ...updates }; return s.entries[id];
  });
  mocks.vault.deleteEntry.mockImplementation(async (id: string) => {
    if (!s.entries[id]) return false; delete s.entries[id]; delete s.index[id]; return true;
  });
  mocks.vault.toggleFavorite.mockImplementation(async (id: string) => {
    if (!s.entries[id]) return null; s.entries[id].favorite = !s.entries[id].favorite; return { favorite: s.entries[id].favorite };
  });
  mocks.cloud.isCloudSyncAvailable.mockImplementation(async () => s.cloudAvailable);
  mocks.cloud.downloadFileFromCloud.mockImplementation(async () => { s.cloudRestored = true; });
  mocks.twoFa.verifyBackupCode.mockReturnValue(-1);
  mocks.twoFa.verifyVault2FACode.mockReturnValue(false);

  mocks.fs.readFile.mockRejectedValue(new Error('no logo'));
  mocks.fs.mkdtemp.mockImplementation(async () => `/tmp/mock-upload-${++s.uploadCounter}`);
  mocks.fs.writeFile.mockImplementation(async (filePath: string, data: Buffer) => { s.uploadFiles.set(filePath, Buffer.from(data)); });
  mocks.fs.appendFile.mockImplementation(async (filePath: string, data: Buffer) => { s.uploadFiles.set(filePath, Buffer.concat([s.uploadFiles.get(filePath) ?? Buffer.alloc(0), Buffer.from(data)])); });
  mocks.fs.unlink.mockImplementation(async (filePath: string) => { s.uploadFiles.delete(filePath); });
  mocks.fs.rm.mockResolvedValue(undefined);
  mocks.fs.access.mockResolvedValue(undefined);
}

async function body(response: Response): Promise<any> {
  return response.json();
}

async function request(handle: Handle, pathname: string, init: RequestInit = {}, guarded = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (guarded) headers.set('X-BlankDrive-UI', handle.capability);
  return fetch(`${handle.url}${pathname}`, { ...init, headers });
}

async function jsonRequest(handle: Handle, pathname: string, value: unknown, method = 'POST'): Promise<Response> {
  return request(handle, pathname, {
    method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(value),
  });
}

describe('web UI server direct HTTP coverage', () => {
  let handle: Handle | null = null;

  beforeEach(() => resetState());
  afterEach(async () => {
    if (handle) await handle.close();
    handle = null;
    vi.restoreAllMocks();
  });

  async function server(): Promise<Handle> {
    handle ??= await startWebUiServer({ port: 0, capability: 'test-capability' });
    return handle;
  }

  it('serves HTML with nonce/capability and enforces localhost, headers, and guard', async () => {
    const h = await server();
    const html = await request(h, '/', {}, false);
    expect(html.status).toBe(200);
    const text = await html.text();
    expect(text).toContain('nonce=');
    expect(text).toContain('const UI_CAPABILITY="test-capability";');
    expect(html.headers.get('content-security-policy')).toContain("script-src 'nonce-");
    expect(html.headers.get('x-content-type-options')).toBe('nosniff');
    expect(html.headers.get('x-frame-options')).toBe('DENY');
    expect((await request(h, '/api/status', {}, false)).status).toBe(403);
    const evil = await fetch(h.url + '/api/status', { headers: { Host: 'evil.example' } });
    expect(evil.status).toBe(403);
    expect((await request(h, '/not-found')).status).toBe(404);
    expect((await request(h, '/', { method: 'POST' }, false)).status).toBe(404);
  });

  it('covers status, initialization, lock/unlock, method checks, and validation errors', async () => {
    const h = await server();
    let response = await request(h, '/api/status');
    expect(response.status).toBe(200);
    expect(await body(response)).toMatchObject({ vaultExists: true, unlocked: true, stats: { entryCount: 3 } });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await request(h, '/api/status', { method: 'POST' })).status).toBe(405);
    expect((await request(h, '/api/init', {}, true)).status).toBe(405);

    mocks.state.exists = false;
    response = await jsonRequest(h, '/api/init', { password: 'new-password' });
    expect(response.status).toBe(201);
    expect(await body(response)).toMatchObject({ initialized: true, unlocked: true });
    mocks.state.exists = true;
    response = await jsonRequest(h, '/api/init', { password: 'again' });
    expect(response.status).toBe(409);
    expect((await jsonRequest(h, '/api/init', {})).status).toBe(400);
    expect((await request(h, '/api/unlock', { method: 'GET' })).status).toBe(405);
    mocks.state.exists = false;
    expect((await jsonRequest(h, '/api/unlock', { password: 'x' })).status).toBe(404);
    mocks.state.exists = true;
    mocks.state.unlocked = false;
    expect((await jsonRequest(h, '/api/lock', {})).status).toBe(200);
    expect((await request(h, '/api/lock', { method: 'GET' })).status).toBe(405);
    expect((await jsonRequest(h, '/api/unlock', { password: 'good' })).status).toBe(200);
    expect((await jsonRequest(h, '/api/unlock', { password: 'good' }, 'PUT')).status).toBe(405);
    expect((await request(h, '/api/status', { method: 'GET' })).status).toBe(200);
    expect((await request(h, '/api/status', { method: 'POST', body: '{' })).status).toBe(405);
    expect((await request(h, '/api/entries', { method: 'POST', body: '{' })).status).toBe(400);
    expect((await request(h, '/api/entries', { method: 'POST', body: '[]' })).status).toBe(400);
  });

  it('covers 2FA TOTP and backup-code unlock paths', async () => {
    const h = await server();
    mocks.state.unlocked = false;
    mocks.state.twoFa = { enabled: true, secret: 'ABCDEFGHIJKLMNOP' , backupCodes: ['hashed'] };
    mocks.twoFa.verifyVault2FACode.mockReturnValue(true);
    let response = await jsonRequest(h, '/api/unlock', { password: 'good', code: '123 456' });
    expect(response.status).toBe(200);
    expect(mocks.twoFa.verifyVault2FACode).toHaveBeenCalledWith('123456', 'ABCDEFGHIJKLMNOP');

    mocks.state.unlocked = false;
    mocks.twoFa.verifyVault2FACode.mockReturnValue(false);
    mocks.twoFa.verifyBackupCode.mockReturnValue(0);
    response = await jsonRequest(h, '/api/unlock', { password: 'good', code: 'ABCD1234' });
    expect(response.status).toBe(200);
    expect(mocks.vault.useBackupCode).toHaveBeenCalledWith(0);

    mocks.state.unlocked = false;
    mocks.twoFa.verifyBackupCode.mockReturnValue(-1);
    response = await jsonRequest(h, '/api/unlock', { password: 'good', code: 'bad' });
    expect(response.status).toBe(401);
    expect(mocks.vault.lock).toHaveBeenCalled();
  });

  it('covers entry listing, filters, create, detail, update, favorite, delete, and method paths', async () => {
    const h = await server();
    let response = await request(h, '/api/entries?query=pass&type=password');
    expect(await body(response)).toEqual({ entries: [passwordEntry()] });
    response = await request(h, '/api/entries?type=unknown');
    expect((await body(response)).entries).toHaveLength(3);
    response = await jsonRequest(h, '/api/entries', { type: 'note', title: 'New Note', content: '' });
    expect(response.status).toBe(201);
    response = await jsonRequest(h, '/api/entries', { title: 'New Password', url: 'not-a-url' });
    expect(response.status).toBe(400);
    response = await jsonRequest(h, '/api/entries', { title: 'New Password', username: 'u', password: 'p', url: 'https://ok.test' });
    expect(response.status).toBe(201);

    response = await request(h, '/api/entries/p1');
    expect((await body(response)).entry.id).toBe('p1');
    response = await jsonRequest(h, '/api/entries/p1', { title: 'Updated', password: '' }, 'PUT');
    expect(response.status).toBe(200);
    response = await jsonRequest(h, '/api/entries/n1', { content: 'updated' }, 'PUT');
    expect(response.status).toBe(200);
    response = await jsonRequest(h, '/api/entries/f1', {}, 'PUT');
    expect(response.status).toBe(400);
    response = await jsonRequest(h, '/api/entries/p1/favorite', {}, 'POST');
    expect(response.status).toBe(200);
    response = await request(h, '/api/entries/p1/favorite');
    expect(response.status).toBe(405);
    response = await request(h, '/api/entries/p1', { method: 'PATCH' });
    expect(response.status).toBe(405);
    response = await request(h, '/api/entries/no-such');
    expect(response.status).toBe(404);
    response = await request(h, '/api/entries/p1/unknown');
    expect(response.status).toBe(404);
    response = await request(h, '/api/entries/n1', { method: 'DELETE' });
    expect(response.status).toBe(200);
    response = await request(h, '/api/entries/p1', { method: 'DELETE' });
    expect(response.status).toBe(200);
    expect((await request(h, '/api/entries/p1', { method: 'DELETE' })).status).toBe(404);

    mocks.state.unlocked = false;
    expect((await request(h, '/api/entries')).status).toBe(423);
  });

  it('covers chunked upload success, ordering, abort, legacy removal, and validation', async () => {
    const h = await server();
    let response = await jsonRequest(h, '/api/files/upload/start', { fileName: 'payload.txt', title: 'Payload', totalSize: 262145, chunkSize: 262144 });
    expect(response.status).toBe(201);
    const init = await body(response);
    expect(init.totalChunks).toBe(2);
    response = await request(h, `/api/files/upload/chunk?uploadId=${init.uploadId}&index=1`, { method: 'POST', body: Buffer.alloc(1) });
    expect(response.status).toBe(409);
    response = await request(h, `/api/files/upload/chunk?uploadId=${init.uploadId}&index=0`, { method: 'POST', body: Buffer.alloc(262144) });
    expect(response.status).toBe(200);
    response = await request(h, `/api/files/upload/chunk?uploadId=${init.uploadId}&index=1`, { method: 'POST', body: Buffer.from('x') });
    expect(response.status).toBe(200);
    response = await jsonRequest(h, '/api/files/upload/complete', { uploadId: init.uploadId });
    expect(response.status).toBe(201);
    expect(mocks.vault.addFileEntry).toHaveBeenCalledWith('Payload', expect.stringContaining('payload.txt'), undefined);

    response = await jsonRequest(h, '/api/files/upload/start', { fileName: 'bad.exe', totalSize: 0 });
    expect(response.status).toBe(400);
    response = await jsonRequest(h, '/api/files/upload/start', { fileName: 'noextension', totalSize: 0 });
    expect(response.status).toBe(400);
    response = await jsonRequest(h, '/api/files/upload/start', { fileName: 'empty.txt', totalSize: 0 });
    const empty = await body(response);
    expect(empty.totalChunks).toBe(0);
    response = await jsonRequest(h, '/api/files/upload/complete', { uploadId: empty.uploadId });
    expect(response.status).toBe(201);
    response = await jsonRequest(h, '/api/files/upload/start', { fileName: 'abort.txt', totalSize: 0 });
    const aborted = await body(response);
    response = await jsonRequest(h, '/api/files/upload/abort', { uploadId: aborted.uploadId });
    expect(await body(response)).toEqual({ aborted: true });
    expect((await jsonRequest(h, '/api/files/upload/complete', { uploadId: aborted.uploadId })).status).toBe(404);
    expect((await request(h, '/api/files/upload/start', { method: 'GET' })).status).toBe(405);
    expect((await request(h, '/api/files/upload/chunk', { method: 'POST' })).status).toBe(400);
    expect((await jsonRequest(h, '/api/files/upload', {})).status).toBe(410);
    expect((await request(h, '/api/files/upload', { method: 'GET' })).status).toBe(405);
    expect((await jsonRequest(h, '/api/cli/run', { command: 'status' })).status).toBe(410);
    expect((await request(h, '/api/cli/run', { method: 'GET' })).status).toBe(405);
  });

  it('covers download, stream ranges, MIME hardening, invalid ranges, and cloud recovery', async () => {
    const h = await server();
    let response = await request(h, '/api/files/f1/download');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('abcdef');
    expect(response.headers.get('content-disposition')).toContain('filename="clip.html"');
    response = await request(h, '/api/files/f1/stream');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    response = await request(h, '/api/files/f1/stream', { headers: { Range: 'bytes=1-3' } });
    expect(response.status).toBe(206);
    expect(await response.text()).toBe('bcd');
    expect(response.headers.get('content-range')).toBe('bytes 1-3/6');
    response = await request(h, '/api/files/f1/stream', { headers: { Range: 'bytes=-2' } });
    expect(await response.text()).toBe('ef');
    response = await request(h, '/api/files/f1/stream', { headers: { Range: 'bytes=4-' } });
    expect(await response.text()).toBe('ef');
    expect((await request(h, '/api/files/f1/stream', { headers: { Range: 'items=1-2' } })).status).toBe(416);
    expect((await request(h, '/api/files/f1/stream', { headers: { Range: 'bytes=99-100' } })).status).toBe(416);
    expect((await request(h, '/api/files/f1/download', { method: 'POST' })).status).toBe(405);
    expect((await request(h, '/api/files/f1/stream', { method: 'POST' })).status).toBe(405);
    expect((await request(h, '/api/files/no-such/download')).status).toBe(404);

    mocks.state.missingFileData = true;
    response = await request(h, '/api/files/f1/download');
    expect(response.status).toBe(200);
    expect(mocks.cloud.downloadFileFromCloud).toHaveBeenCalledWith('f1', [{ chunkIndex: 0, driveFileId: 'cloud-1', size: 6 }]);
    mocks.state.cloudRestored = false;
    mocks.state.cloudAvailable = false;
    expect((await request(h, '/api/files/f1/download')).status).toBe(409);
    mocks.state.missingFileData = false;
    mocks.state.fileData = Buffer.alloc(0);
    mocks.state.entries.f1.size = 0;
    expect((await request(h, '/api/files/f1/stream', { headers: { Range: 'bytes=0-0' } })).status).toBe(416);

    mocks.state.unlocked = false;
    expect((await request(h, '/api/files/f1/download')).status).toBe(423);
  });

  it('covers favicon, logo, error sanitization, and server option validation', async () => {
    const h = await server();
    expect((await request(h, '/favicon.ico', {}, false)).status).toBe(204);
    expect((await request(h, '/api/brand/logo', {}, false)).status).toBe(404);
    expect((await request(h, '/api/brand/logo', { method: 'POST' }, false)).status).toBe(405);
    mocks.state.exists = false;
    mocks.vault.initVault.mockRejectedValueOnce(new Error('PASSWORD=must-not-leak'));
    const response = await jsonRequest(h, '/api/init', { password: 'x' });
    expect(response.status).toBe(500);
    expect(await body(response)).toEqual({ error: 'Internal Server Error' });
    await h.close();
    handle = null;
    await expect(startWebUiServer({ host: '127.0.0.1', port: 0 })).rejects.toThrow('fixed to localhost');
  });
});
