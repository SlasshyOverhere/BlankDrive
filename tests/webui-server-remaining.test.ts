import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state = { exists: true, unlocked: true, logo: null as Buffer | null, entries: {} as Record<string, any>, index: {} as Record<string, any>, fileData: Buffer.from('abcdef'), missing: false, cloud: true, cloudError: false, uploadFiles: new Map<string, Buffer>(), counter: 0 };
  const vault = { initVault: vi.fn(), vaultExists: vi.fn(), isUnlocked: vi.fn(), getStats: vi.fn(), getVaultPaths: vi.fn(), getVault2FAConfig: vi.fn(), addEntry: vi.fn(), addNoteEntry: vi.fn(), addFileEntry: vi.fn(), deleteEntry: vi.fn(), getEntry: vi.fn(), getFileData: vi.fn(), getFileEntry: vi.fn(), getNoteEntry: vi.fn(), getVaultIndex: vi.fn(), listEntries: vi.fn(), lock: vi.fn(), toggleFavorite: vi.fn(), unlock: vi.fn(), updateEntry: vi.fn(), updateNoteEntry: vi.fn(), useBackupCode: vi.fn() };
  const cloud = { downloadFileFromCloud: vi.fn(), isCloudSyncAvailable: vi.fn() };
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

const seed = () => {
  const s = mocks.state;
  s.exists = true; s.unlocked = true; s.logo = null; s.fileData = Buffer.from('abcdef'); s.missing = false; s.cloud = true; s.cloudError = false; s.uploadFiles.clear(); s.counter = 0;
  s.entries = { p: { id: 'p', type: 'password', title: 'Password', favorite: false }, n: { id: 'n', type: 'note', title: 'Note', content: 'body', favorite: false }, f: { id: 'f', type: 'file', title: 'File', originalName: 'file.txt', mimeType: 'text/plain', size: 6 } };
  s.index = { p: { entryType: 'password' }, n: { entryType: 'note' }, f: { entryType: 'file', cloudChunks: [{ chunkIndex: 0, driveFileId: 'cloud', size: 6 }] } };
  vi.clearAllMocks();
  mocks.vault.vaultExists.mockImplementation(async () => s.exists); mocks.vault.isUnlocked.mockImplementation(() => s.unlocked); mocks.vault.getStats.mockReturnValue({ entryCount: Object.keys(s.entries).length }); mocks.vault.getVaultPaths.mockReturnValue({ dir: '/vault' }); mocks.vault.getVault2FAConfig.mockReturnValue(undefined); mocks.vault.getVaultIndex.mockReturnValue({ entries: s.index }); mocks.vault.listEntries.mockResolvedValue(Object.values(s.entries));
  mocks.vault.getEntry.mockImplementation(async (id: string) => s.entries[id]?.type === 'password' ? s.entries[id] : null); mocks.vault.getNoteEntry.mockImplementation(async (id: string) => s.entries[id]?.type === 'note' ? s.entries[id] : null); mocks.vault.getFileEntry.mockImplementation(async (id: string) => s.entries[id]?.type === 'file' ? s.entries[id] : null); mocks.vault.getFileData.mockImplementation(async () => { if (s.missing) throw new Error('missing chunk'); return s.fileData; });
  mocks.vault.initVault.mockImplementation(async () => { s.exists = true; s.unlocked = true; }); mocks.vault.unlock.mockImplementation(async (password: string) => { if (password === 'invalid') throw new Error('invalid key'); if (password === 'other') throw new Error('unexpected'); s.unlocked = true; }); mocks.vault.lock.mockImplementation(() => { s.unlocked = false; }); mocks.vault.useBackupCode.mockResolvedValue(undefined);
  mocks.vault.addEntry.mockResolvedValue({ id: 'new', type: 'password', title: 'New' }); mocks.vault.addNoteEntry.mockResolvedValue({ id: 'new-note', type: 'note', title: 'New' }); mocks.vault.addFileEntry.mockResolvedValue({ id: 'new-file', type: 'file', originalName: 'upload.txt', mimeType: 'text/plain', size: 1 }); mocks.vault.deleteEntry.mockResolvedValue(true); mocks.vault.toggleFavorite.mockResolvedValue({ favorite: true }); mocks.vault.updateEntry.mockResolvedValue({ id: 'p' }); mocks.vault.updateNoteEntry.mockResolvedValue({ id: 'n' });
  mocks.cloud.isCloudSyncAvailable.mockImplementation(async () => s.cloud); mocks.cloud.downloadFileFromCloud.mockImplementation(async () => { if (s.cloudError) throw new Error('cloud failed'); s.missing = false; }); mocks.fs.readFile.mockImplementation(async () => { if (s.logo) return s.logo; throw new Error('no logo'); }); mocks.fs.mkdtemp.mockImplementation(async () => `/tmp/upload-${++s.counter}`); mocks.fs.writeFile.mockResolvedValue(undefined); mocks.fs.appendFile.mockResolvedValue(undefined); mocks.fs.unlink.mockResolvedValue(undefined); mocks.fs.rm.mockResolvedValue(undefined); mocks.fs.access.mockResolvedValue(undefined);
  mocks.twoFa.verifyBackupCode.mockReturnValue(-1); mocks.twoFa.verifyVault2FACode.mockReturnValue(false);
};

async function request(handle: Handle, path: string, init: RequestInit = {}, guard = true): Promise<Response> { const headers = new Headers(init.headers); if (guard) headers.set('x-blankdrive-ui', handle.capability); return fetch(`${handle.url}${path}`, { ...init, headers }); }
const json = (handle: Handle, path: string, value: unknown, method = 'POST') => request(handle, path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) });
const read = (r: Response) => r.json();

describe('Web UI remaining direct branches', () => {
  let handle: Handle | undefined;
  beforeEach(() => seed());
  afterEach(async () => { if (handle) await handle.close(); handle = undefined; });
  const server = async () => handle ??= await startWebUiServer({ port: 0, capability: 'cap' });

  it('covers locked status, logo/favicon success, capability and host parsing', async () => {
    const h = await server();
    mocks.state.unlocked = false;
    let r = await request(h, '/api/status'); expect(await read(r)).toMatchObject({ unlocked: false, stats: null });
    expect((await request(h, '/api/status', {}, false)).status).toBe(403);
    mocks.state.logo = Buffer.from('png');
    r = await request(h, '/api/brand/logo', {}, false); expect(r.status).toBe(200); expect(await r.text()).toBe('png');
    r = await request(h, '/favicon.ico', {}, false); expect(r.status).toBe(200); expect(await r.text()).toBe('png');
    expect((await fetch(h.url + '/api/status', { headers: { Host: '[::1]:1234', 'x-blankdrive-ui': h.capability } })).status).toBe(200);
    expect((await fetch(h.url + '/api/status', { headers: { Host: '127.0.0.42:1234', 'x-blankdrive-ui': h.capability } })).status).toBe(200);
  });

  it('covers validation errors, route decoding, and entry branches', async () => {
    const h = await server();
    expect((await json(h, '/api/entries', { title: '' })).status).toBe(400);
    expect((await json(h, '/api/entries', { title: 'x', favorite: 'yes' })).status).toBe(201);
    expect((await json(h, '/api/entries', { title: 'x', url: 'ftp://bad' })).status).toBe(400);
    expect((await json(h, '/api/entries', { type: 'note', title: 'n', content: 'c', favorite: 'yes' })).status).toBe(400);
    expect((await json(h, '/api/entries/p', { title: 3 }, 'PUT')).status).toBe(400);
    expect((await json(h, '/api/entries/n', { title: '' }, 'PUT')).status).toBe(400);
    expect((await request(h, '/api/entries/%E0%A4%A', {}, true)).status).toBe(400);
    expect((await request(h, '/api/entries/p/unknown')).status).toBe(404);
    expect((await request(h, '/api/entries/p', { method: 'PATCH' })).status).toBe(405);
    mocks.state.unlocked = false; expect((await request(h, '/api/entries')).status).toBe(423);
  });

  it('covers upload validation, incomplete chunks, and cleanup paths', async () => {
    const h = await server();
    expect((await json(h, '/api/files/upload/start', { fileName: 'noextension', totalSize: 0 })).status).toBe(400);
    expect((await json(h, '/api/files/upload/start', { fileName: 'bad.exe', totalSize: 0 })).status).toBe(400);
    const start = await json(h, '/api/files/upload/start', { fileName: 'data.txt', totalSize: 262145, chunkSize: 262144 }); const info = await read(start);
    expect((await json(h, '/api/files/upload/complete', { uploadId: info.uploadId })).status).toBe(409);
    expect((await request(h, `/api/files/upload/chunk?uploadId=${info.uploadId}&index=0`, { method: 'POST', body: Buffer.alloc(1) })).status).toBe(400);
    expect((await request(h, `/api/files/upload/chunk?uploadId=${info.uploadId}&index=0`, { method: 'POST', body: Buffer.alloc(262144) })).status).toBe(200);
    expect((await request(h, `/api/files/upload/chunk?uploadId=${info.uploadId}&index=0`, { method: 'POST', body: Buffer.alloc(262144) })).status).toBe(409);
    expect((await json(h, '/api/files/upload/abort', { uploadId: info.uploadId })).status).toBe(200);
    expect((await json(h, '/api/files/upload/complete', { uploadId: info.uploadId })).status).toBe(404);
    expect((await request(h, '/api/files/upload/chunk?uploadId=x&index=-1', { method: 'POST', body: Buffer.alloc(0) })).status).toBe(400);
  });

  it('covers cloud recovery outcomes, empty downloads, and range errors', async () => {
    const h = await server();
    mocks.state.missing = true; mocks.state.cloud = false;
    expect((await request(h, '/api/files/f/download')).status).toBe(409);
    mocks.state.cloud = true; mocks.state.cloudError = true;
    expect((await request(h, '/api/files/f/download')).status).toBe(409);
    mocks.state.cloudError = false; mocks.state.missing = true;
    expect((await request(h, '/api/files/f/download')).status).toBe(200);
    expect((await request(h, '/api/files/f/stream', { headers: { Range: 'bytes=2-1' } })).status).toBe(416);
    expect((await request(h, '/api/files/f/stream', { headers: { Range: 'bytes=-0' } })).status).toBe(416);
    mocks.state.fileData = Buffer.alloc(0); mocks.state.entries.f.size = 0;
    expect((await request(h, '/api/files/f/stream', { headers: { Range: 'bytes=0-0' } })).status).toBe(416);
  });

  it('covers invalid unlocks, rate limiting, and server option defaults', async () => {
    const h = await server();
    mocks.state.unlocked = false;
    for (let i = 0; i < 6; i++) { const r = await json(h, '/api/unlock', { password: 'invalid' }); if (i < 5) expect(r.status).toBe(401); else expect(r.status).toBe(429); }
    mocks.state.exists = false; expect((await json(h, '/api/unlock', { password: 'x' })).status).toBe(404);
    await h.close(); handle = undefined;
    const generated = await startWebUiServer({ port: 0 }); expect(generated.capability).toMatch(/^[0-9a-f]+$/); await generated.close();
    await expect(startWebUiServer({ host: '127.0.0.1', port: 0 })).rejects.toThrow('fixed to localhost');
  });
});
