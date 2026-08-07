import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state = {
    unlocked: true,
    fileMode: 'normal' as 'normal' | 'missing' | 'null' | 'retry' | 'other',
    cloudAvailable: true,
    cloudError: false,
    uploadFiles: new Map<string, Buffer>(),
    uploadCounter: 0,
    entries: {
      p: { id: 'p', type: 'password', title: 'Password', favorite: false },
      n: { id: 'n', type: 'note', title: 'Note', content: 'body', favorite: false },
      f: { id: 'f', type: 'file', title: 'File', originalName: 'file.txt', mimeType: 'text/plain', size: 6 },
    } as Record<string, any>,
    index: {
      p: { entryType: 'password' },
      n: { entryType: 'note' },
      f: { entryType: 'file', cloudChunks: [{ chunkIndex: 0, driveFileId: 'cloud', size: 6 }] },
    } as Record<string, any>,
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

function resetState(): void {
  const s = mocks.state;
  s.unlocked = true;
  s.fileMode = 'normal';
  s.cloudAvailable = true;
  s.cloudError = false;
  s.uploadFiles.clear();
  s.uploadCounter = 0;
  vi.clearAllMocks();

  mocks.vault.vaultExists.mockResolvedValue(true);
  mocks.vault.isUnlocked.mockImplementation(() => s.unlocked);
  mocks.vault.getStats.mockReturnValue({ entryCount: Object.keys(s.entries).length });
  mocks.vault.getVaultPaths.mockReturnValue({ dir: '/vault' });
  mocks.vault.getVault2FAConfig.mockReturnValue(undefined);
  mocks.vault.getVaultIndex.mockImplementation(() => ({ entries: s.index }));
  mocks.vault.listEntries.mockResolvedValue(Object.values(s.entries));
  mocks.vault.getEntry.mockImplementation(async (id: string) => s.entries[id]?.type === 'password' ? s.entries[id] : null);
  mocks.vault.getNoteEntry.mockImplementation(async (id: string) => s.entries[id]?.type === 'note' ? s.entries[id] : null);
  mocks.vault.getFileEntry.mockImplementation(async (id: string) => s.entries[id]?.type === 'file' ? s.entries[id] : null);
  mocks.vault.getFileData.mockImplementation(async () => {
    if (s.fileMode === 'null') return null;
    if (s.fileMode === 'missing' || s.fileMode === 'retry') throw new Error('missing chunk');
    if (s.fileMode === 'other') throw new Error('disk failed');
    return Buffer.from('abcdef');
  });
  mocks.vault.lock.mockImplementation(() => { s.unlocked = false; });
  mocks.vault.unlock.mockImplementation(async () => { s.unlocked = true; });
  mocks.vault.initVault.mockResolvedValue(undefined);
  mocks.vault.addFileEntry.mockImplementation(async (title: string, filePath: string, notes?: string) => ({ id: 'uploaded', type: 'file', title, filePath, notes }));
  mocks.vault.addEntry.mockResolvedValue({ id: 'new', type: 'password', title: 'new' });
  mocks.vault.addNoteEntry.mockResolvedValue({ id: 'new-note', type: 'note', title: 'new' });
  mocks.vault.deleteEntry.mockResolvedValue(true);
  mocks.vault.toggleFavorite.mockResolvedValue({ favorite: true });
  mocks.vault.updateEntry.mockResolvedValue({ id: 'p' });
  mocks.vault.updateNoteEntry.mockResolvedValue({ id: 'n' });
  mocks.vault.useBackupCode.mockResolvedValue(undefined);
  mocks.cloud.isCloudSyncAvailable.mockImplementation(async () => s.cloudAvailable);
  mocks.cloud.downloadFileFromCloud.mockImplementation(async () => {
    if (s.cloudError) throw new Error('cloud failed');
  });
  mocks.twoFa.verifyBackupCode.mockReturnValue(-1);
  mocks.twoFa.verifyVault2FACode.mockReturnValue(false);

  mocks.fs.readFile.mockRejectedValue(new Error('no logo'));
  mocks.fs.mkdtemp.mockImplementation(async () => `/tmp/web-upload-${++s.uploadCounter}`);
  mocks.fs.writeFile.mockImplementation(async (filePath: string, data: Buffer) => { s.uploadFiles.set(filePath, Buffer.from(data)); });
  mocks.fs.appendFile.mockImplementation(async (filePath: string, data: Buffer) => {
    s.uploadFiles.set(filePath, Buffer.concat([s.uploadFiles.get(filePath) ?? Buffer.alloc(0), Buffer.from(data)]));
  });
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
  return request(handle, pathname, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  });
}

async function responseJson(response: Response): Promise<any> {
  return response.json();
}

describe('web UI server uncovered edge branches', () => {
  let handle: Handle | undefined;

  beforeEach(resetState);
  afterEach(async () => {
    if (handle) {
      try { await request(handle, '/api/lock', { method: 'POST' }); } catch { /* request may be reset by an oversized body */ }
      await handle.close();
    }
    handle = undefined;
    vi.restoreAllMocks();
  });

  async function server(): Promise<Handle> {
    handle ??= await startWebUiServer({ host: 'LOCALHOST', port: 0, capability: 'edge-capability' });
    return handle;
  }

  it('uses real localhost startup, rejects a bind collision, and enforces methods/capabilities', async () => {
    const first = await server();
    const port = Number(new URL(first.url).port);
    await expect(startWebUiServer({ port, capability: 'other' })).rejects.toMatchObject({ code: 'EADDRINUSE' });

    expect((await request(first, '/api/status', {}, false)).status).toBe(403);
    expect((await request(first, '/api/files/upload/complete', { method: 'GET' })).status).toBe(405);
    expect((await request(first, '/api/files/upload/chunk', { method: 'GET' })).status).toBe(405);
    expect((await request(first, '/api/files/upload/abort', { method: 'GET' })).status).toBe(405);
    expect((await request(first, '/api/brand/logo', { method: 'POST' }, false)).status).toBe(405);
  });

  it('expires upload sessions, enforces the active-session limit, and handles empty bodies', async () => {
    const h = await server();
    const first = await json(h, '/api/files/upload/start', { fileName: 'old.txt', totalSize: 0 });
    expect(first.status).toBe(201);

    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 60 * 60 * 1000 + 1);
    const second = await json(h, '/api/files/upload/start', { fileName: 'fresh.txt', totalSize: 0 });
    clock.mockRestore();
    expect(second.status).toBe(201);
    expect(mocks.fs.unlink).toHaveBeenCalled();
    expect(mocks.fs.rm).toHaveBeenCalled();

    for (let i = 0; i < 7; i++) {
      expect((await json(h, '/api/files/upload/start', { fileName: `file-${i}.txt`, totalSize: 0 })).status).toBe(201);
    }
    expect((await json(h, '/api/files/upload/start', { fileName: 'too-many.txt', totalSize: 0 })).status).toBe(429);

    expect((await request(h, '/api/init', { method: 'POST', headers: { 'content-type': 'application/json' } })).status).toBe(400);
    expect((await request(h, '/api/entries', { method: 'POST', body: '[]' })).status).toBe(400);
    expect((await request(h, '/api/files/f/download', { method: 'POST' })).status).toBe(405);
  });

  it('covers JSON and binary body-size failures through the HTTP server', async () => {
    const h = await server();
    await expect(request(h, '/api/init', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'x'.repeat(1_000_001) }),
    })).rejects.toThrow();

    const start = await json(h, '/api/files/upload/start', {
      fileName: 'large.txt', totalSize: 4 * 1024 * 1024 + 2, chunkSize: 4 * 1024 * 1024,
    });
    expect(start.status).toBe(201);
    const { uploadId } = await responseJson(start);
    await expect(request(h, `/api/files/upload/chunk?uploadId=${uploadId}&index=0`, {
      method: 'POST', body: Buffer.alloc(4 * 1024 * 1024 + 2),
    })).rejects.toThrow();
  });

  it('covers malformed route IDs, missing routes, cloud fallback failures, and null data', async () => {
    const h = await server();
    expect((await request(h, '/api/entries/%E0%A4%A')).status).toBe(400);
    expect((await request(h, '/api/files/%E0%A4%A/download')).status).toBe(400);
    expect((await request(h, '/api/files/%E0%A4%A/stream')).status).toBe(400);
    expect((await request(h, '/api/entries/p/unknown/extra')).status).toBe(404);
    expect((await request(h, '/api/files/f/wrong')).status).toBe(404);

    mocks.state.fileMode = 'missing';
    mocks.state.cloudAvailable = false;
    expect((await request(h, '/api/files/f/download')).status).toBe(409);

    mocks.state.cloudAvailable = true;
    mocks.state.cloudError = true;
    expect((await request(h, '/api/files/f/download')).status).toBe(409);

    mocks.state.cloudError = false;
    mocks.state.fileMode = 'retry';
    expect((await request(h, '/api/files/f/download')).status).toBe(409);
    expect(mocks.cloud.downloadFileFromCloud).toHaveBeenCalled();

    mocks.state.fileMode = 'other';
    expect((await request(h, '/api/files/f/download')).status).toBe(409);
    expect(mocks.cloud.downloadFileFromCloud).toHaveBeenCalledTimes(2);

    mocks.state.fileMode = 'null';
    expect((await request(h, '/api/files/f/download')).status).toBe(404);
  });

  it('covers logo candidate fallback/cache and range edge cases', async () => {
    const h = await server();
    mocks.fs.readFile
      .mockRejectedValueOnce(new Error('first missing'))
      .mockResolvedValueOnce(Buffer.alloc(0))
      .mockResolvedValueOnce(Buffer.from('logo-bytes'));
    let response = await request(h, '/api/brand/logo', {}, false);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('logo-bytes');
    expect((await request(h, '/favicon.ico', {}, false)).status).toBe(200);
    expect(mocks.fs.readFile).toHaveBeenCalledTimes(3);

    response = await request(h, '/api/files/f/stream', { headers: { range: 'bytes=0-100' } });
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 0-5/6');
    expect(await response.text()).toBe('abcdef');
    expect((await request(h, '/api/files/f/stream', { headers: { range: 'bytes=-' } })).status).toBe(416);
    expect((await request(h, '/api/files/f/stream', { headers: { range: 'bytes=4-2' } })).status).toBe(416);
    expect((await request(h, '/api/files/f/stream', { headers: { range: 'bytes=-0' } })).status).toBe(416);
  });
});
