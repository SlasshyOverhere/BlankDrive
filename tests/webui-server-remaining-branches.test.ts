import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state = { unlocked: true, exists: true, entries: {} as Record<string, any>, index: {} as Record<string, any> };
  const vault = {
    initVault: vi.fn(), vaultExists: vi.fn(), isUnlocked: vi.fn(), getStats: vi.fn(), getVaultPaths: vi.fn(),
    getVault2FAConfig: vi.fn(), addEntry: vi.fn(), addNoteEntry: vi.fn(), addFileEntry: vi.fn(), deleteEntry: vi.fn(),
    getEntry: vi.fn(), getFileData: vi.fn(), getFileEntry: vi.fn(), getNoteEntry: vi.fn(), getVaultIndex: vi.fn(),
    listEntries: vi.fn(), lock: vi.fn(), toggleFavorite: vi.fn(), unlock: vi.fn(), updateEntry: vi.fn(), updateNoteEntry: vi.fn(), useBackupCode: vi.fn(),
  };
  const cloud = { deleteFileFromCloud: vi.fn(), downloadFileFromCloud: vi.fn(), isCloudSyncAvailable: vi.fn() };
  const twoFa = { verifyBackupCode: vi.fn(), verifyVault2FACode: vi.fn() };
  const fs = { readFile: vi.fn(), mkdtemp: vi.fn(), writeFile: vi.fn(), appendFile: vi.fn(), unlink: vi.fn(), rm: vi.fn(), access: vi.fn() };
  return { state, vault, cloud, twoFa, fs };
});

vi.mock('../src/storage/vault/index.js', () => mocks.vault);
vi.mock('../src/storage/drive/index.js', () => mocks.cloud);
vi.mock('../src/cli/vault2fa.js', () => mocks.twoFa);
vi.mock('node:fs/promises', () => ({ default: mocks.fs }));
vi.mock('node:child_process', () => ({ execFile: vi.fn() }));

import { startWebUiServer } from '../src/webui/server.js';

type Handle = Awaited<ReturnType<typeof startWebUiServer>>;

function seed(): void {
  const s = mocks.state;
  s.unlocked = true;
  s.exists = true;
  s.entries = {
    password: { id: 'password', type: 'password', title: 'Password' },
    note: { id: 'note', type: 'note', title: 'Note', content: 'content' },
    file: { id: 'file', type: 'file', title: 'File', originalName: 'file.txt', mimeType: 'text/plain' },
  };
  s.index = {
    password: { entryType: 'password' },
    note: { entryType: 'note' },
    file: { entryType: 'file', cloudChunks: [{ chunkIndex: 0, driveFileId: 'cloud' }] },
  };
  vi.clearAllMocks();
  mocks.vault.vaultExists.mockImplementation(async () => s.exists);
  mocks.vault.isUnlocked.mockImplementation(() => s.unlocked);
  mocks.vault.getStats.mockReturnValue({ entryCount: Object.keys(s.entries).length });
  mocks.vault.getVaultPaths.mockReturnValue({ dir: '/vault' });
  mocks.vault.getVault2FAConfig.mockReturnValue(undefined);
  mocks.vault.getVaultIndex.mockImplementation(() => ({ entries: s.index }));
  mocks.vault.listEntries.mockResolvedValue(Object.values(s.entries));
  mocks.vault.getEntry.mockImplementation(async (id: string) => s.entries[id]?.type === 'password' ? s.entries[id] : null);
  mocks.vault.getNoteEntry.mockImplementation(async (id: string) => s.entries[id]?.type === 'note' ? s.entries[id] : null);
  mocks.vault.getFileEntry.mockImplementation(async (id: string) => s.entries[id]?.type === 'file' ? s.entries[id] : null);
  mocks.vault.getFileData.mockResolvedValue(Buffer.from('data'));
  mocks.vault.lock.mockImplementation(() => { s.unlocked = false; });
  mocks.vault.unlock.mockResolvedValue(undefined);
  mocks.vault.addEntry.mockResolvedValue({ id: 'new' });
  mocks.vault.addNoteEntry.mockResolvedValue({ id: 'new-note' });
  mocks.vault.addFileEntry.mockResolvedValue({ id: 'new-file' });
  mocks.vault.deleteEntry.mockResolvedValue(true);
  mocks.vault.toggleFavorite.mockResolvedValue({ favorite: true });
  mocks.vault.updateEntry.mockResolvedValue({ id: 'password' });
  mocks.vault.updateNoteEntry.mockResolvedValue({ id: 'note' });
  mocks.cloud.isCloudSyncAvailable.mockResolvedValue(true);
  mocks.cloud.downloadFileFromCloud.mockResolvedValue(undefined);
  mocks.cloud.deleteFileFromCloud.mockResolvedValue(undefined);
  mocks.twoFa.verifyBackupCode.mockReturnValue(-1);
  mocks.twoFa.verifyVault2FACode.mockReturnValue(false);
  mocks.fs.readFile.mockRejectedValue(new Error('no logo'));
  mocks.fs.mkdtemp.mockResolvedValue('/tmp/upload');
  mocks.fs.writeFile.mockResolvedValue(undefined);
  mocks.fs.appendFile.mockResolvedValue(undefined);
  mocks.fs.unlink.mockResolvedValue(undefined);
  mocks.fs.rm.mockResolvedValue(undefined);
  mocks.fs.access.mockResolvedValue(undefined);
}

async function request(handle: Handle, pathname: string, init: RequestInit = {}, guarded = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (guarded) headers.set('x-blankdrive-ui', handle.capability);
  return fetch(`${handle.url}${pathname}`, { ...init, headers });
}
async function json(handle: Handle, pathname: string, value: unknown, method = 'POST'): Promise<Response> {
  return request(handle, pathname, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
}

 describe('web UI exact remaining branches', () => {
  let handle: Handle | undefined;
  beforeEach(seed);
  afterEach(async () => { if (handle) await handle.close(); handle = undefined; });
  async function server(): Promise<Handle> { return handle ??= await startWebUiServer({ port: 0, capability: 'cap' }); }

  it('returns exact body, host, input, and upload validation errors', async () => {
    const h = await server();
    expect((await request(h, '/api/entries', { body: '{', method: 'POST' })).status).toBe(400);
    expect((await request(h, '/api/status', { method: 'GET', headers: { Host: 'evil.example' } }, false)).status).toBe(403);
    expect((await json(h, '/api/entries', { title: 'x', favorite: true })).status).toBe(201);
    expect((await json(h, '/api/entries', { title: 'x'.repeat(257) })).status).toBe(400);
    expect((await json(h, '/api/entries', { title: 3 })).status).toBe(400);
    expect((await json(h, '/api/entries', { title: 'x', url: 'not-a-url' })).status).toBe(400);
    expect((await json(h, '/api/files/upload/start', { fileName: 'x.txt', totalSize: -1 })).status).toBe(400);
    expect((await json(h, '/api/files/upload/start', { fileName: 'x.txt', totalSize: 0, chunkSize: 1 })).status).toBe(400);
    expect((await json(h, '/api/files/upload/start', { fileName: 'x.txt', totalSize: 0, chunkSize: 'large' })).status).toBe(400);
    expect((await request(h, '/api/files/upload/chunk?index=0', { method: 'POST', body: Buffer.alloc(0) })).status).toBe(400);
    expect((await request(h, '/api/files/upload/chunk?uploadId=x', { method: 'POST', body: Buffer.alloc(0) })).status).toBe(400);
    expect((await request(h, '/api/files/upload/chunk?uploadId=unknown&index=0', { method: 'POST', body: Buffer.alloc(0) })).status).toBe(404);
  });

  it('covers empty and invalid entry results plus cloud deletion protection', async () => {
    const h = await server();
    mocks.vault.getEntry.mockResolvedValueOnce(null);
    expect((await request(h, '/api/entries/password')).status).toBe(404);
    mocks.vault.deleteEntry.mockResolvedValueOnce(false);
    expect((await request(h, '/api/entries/password', { method: 'DELETE' })).status).toBe(404);
    mocks.vault.updateEntry.mockResolvedValueOnce(null);
    expect((await json(h, '/api/entries/password', { username: 'u' }, 'PUT')).status).toBe(404);
    mocks.vault.updateNoteEntry.mockResolvedValueOnce(null);
    expect((await json(h, '/api/entries/note', { content: 'new' }, 'PUT')).status).toBe(404);
    mocks.vault.toggleFavorite.mockResolvedValueOnce(null);
    expect((await request(h, '/api/entries/password/favorite', { method: 'POST' })).status).toBe(404);
    mocks.cloud.deleteFileFromCloud.mockRejectedValueOnce(new Error('cloud unavailable'));
    expect((await request(h, '/api/entries/file', { method: 'DELETE' })).status).toBe(409);
    expect((await request(h, '/api/files/missing/download')).status).toBe(404);
  });

  it('rejects upload ordering and chunk-size mismatches', async () => {
    const h = await server();
    const start = await json(h, '/api/files/upload/start', { fileName: 'data.txt', totalSize: 262145, chunkSize: 262144 });
    const { uploadId } = await start.json();
    expect((await request(h, `/api/files/upload/chunk?uploadId=${uploadId}&index=1`, { method: 'POST', body: Buffer.alloc(1) })).status).toBe(409);
    expect((await request(h, `/api/files/upload/chunk?uploadId=${uploadId}&index=0`, { method: 'POST', body: Buffer.alloc(2) })).status).toBe(400);
    expect((await request(h, `/api/files/upload/chunk?uploadId=${uploadId}&index=0`, { method: 'POST', body: Buffer.alloc(262144) })).status).toBe(200);
    expect((await request(h, `/api/files/upload/chunk?uploadId=${uploadId}&index=0`, { method: 'POST', body: Buffer.alloc(1) })).status).toBe(409);
    expect((await request(h, `/api/files/upload/chunk?uploadId=${uploadId}&index=1`, { method: 'POST', body: Buffer.alloc(1) })).status).toBe(200);
  });

  it('exercises two-factor unlock failure and method guard responses', async () => {
    const h = await server();
    mocks.state.unlocked = false;
    mocks.vault.getVault2FAConfig.mockReturnValue({ enabled: true, secret: 'secret', backupCodes: ['ABCD1234'] });
    expect((await json(h, '/api/unlock', { password: 'pass', code: 'wrong' })).status).toBe(401);
    expect((await request(h, '/api/status', { method: 'POST' })).status).toBe(405);
    expect((await request(h, '/api/init', { method: 'GET' })).status).toBe(405);
    expect((await request(h, '/api/lock', { method: 'GET' })).status).toBe(405);
    mocks.state.unlocked = true;
    expect((await request(h, '/api/entries/password', { method: 'PUT' })).status).toBe(200);
    expect((await request(h, '/api/cli/run', { method: 'GET' })).status).toBe(405);
    expect((await request(h, '/api/cli/run', { method: 'POST', body: '{}' })).status).toBe(410);
  });
});
