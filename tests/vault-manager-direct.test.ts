import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  root: `/tmp/vault-manager-direct-${process.pid}-${Date.now()}`,
  unlocked: false,
  indexKey: Buffer.alloc(32, 1),
  entryKey: Buffer.alloc(32, 2),
}));

vi.mock('os', () => ({
  default: {
    homedir: () => fixture.root,
    tmpdir: () => fixture.root,
  },
}));

vi.mock('../src/crypto/index.js', async () => {
  const actual = await vi.importActual<typeof import('../src/crypto/index.js')>('../src/crypto/index.js');
  return {
    ...actual,
    initializeKeyManager: vi.fn(),
    createVault: vi.fn(async () => {
      fixture.unlocked = true;
      return { salt: Buffer.alloc(32, 9), keyHash: Buffer.alloc(32, 8) };
    }),
    unlockVault: vi.fn(async (password: string) => {
      if (password !== 'correct password') throw new Error('bad password');
      fixture.unlocked = true;
    }),
    lockVault: vi.fn(() => { fixture.unlocked = false; }),
    isVaultUnlocked: vi.fn(() => fixture.unlocked),
    getIndexKey: vi.fn(() => {
      if (!fixture.unlocked) throw new Error('Vault is locked');
      return fixture.indexKey;
    }),
    getEntryKey: vi.fn(() => {
      if (!fixture.unlocked) throw new Error('Vault is locked');
      return fixture.entryKey;
    }),
  };
});

import { encryptToBuffer, encryptToPayload } from '../src/crypto/encryption.js';
import * as vault from '../src/storage/vault/vaultManager.js';

const password = 'correct password';
const validId = '00000000-0000-4000-8000-000000000000';
const sha256 = (data: Buffer) => crypto.createHash('sha256').update(data).digest('hex');
const vaultFile = (id: string) => path.join(vault.getVaultPaths().dir, 'entries', `${id}.enc`);
const tempFile = (id: string) => path.join(vault.getTempFilesDir(), `${id}.bin`);
const setChecksum = (id: string, checksum: string) => {
  const indexEntry = vault.getVaultIndex()!.entries[id] as { checksum?: string };
  indexEntry.checksum = checksum;
};

async function init() {
  await vault.initVaultWithHeader(password);
}

beforeEach(async () => {
  vault.lock();
  await fs.rm(fixture.root, { recursive: true, force: true });
  await fs.mkdir(fixture.root, { recursive: true });
});

afterAll(async () => {
  vault.lock();
  await fs.rm(fixture.root, { recursive: true, force: true });
});

describe('vault manager lifecycle and CRUD', () => {
  it('initializes, unlocks, locks, and rejects duplicate or bad-password operations', async () => {
    await expect(vault.vaultExists()).resolves.toBe(false);
    expect(vault.isUnlocked()).toBe(false);
    expect(vault.getStats()).toBeNull();
    await expect(vault.unlock(password)).rejects.toThrow('No vault found');

    await init();
    expect(vault.isUnlocked()).toBe(true);
    expect(await vault.vaultExists()).toBe(true);
    expect(vault.getStats()).toMatchObject({ entryCount: 0, lastSync: null });
    await expect(vault.initVaultWithHeader(password)).rejects.toThrow('already exists');

    vault.lock();
    expect(vault.isUnlocked()).toBe(false);
    await expect(vault.unlock('wrong password')).rejects.toThrow('bad password');
    expect(vault.isUnlocked()).toBe(false);
    await vault.unlock(password);
    expect(vault.isUnlocked()).toBe(true);
  });

  it('supports password CRUD, search, sorted listing, favorites, stats, and deletion', async () => {
    await init();
    const work = await vault.addEntry('Work account', {
      username: 'alice', password: 'secret', url: 'https://example.com', category: 'work', notes: 'private',
    });
    const personal = await vault.addEntry('Personal account', { username: 'bob', password: 'pass' });

    await expect(vault.getEntry(work.id)).resolves.toMatchObject({ title: 'Work account', username: 'alice', notes: 'private' });
    await expect(vault.getEntry(validId)).resolves.toBeNull();
    await expect(vault.searchEntries('WORK')).resolves.toEqual([expect.objectContaining({ id: work.id })]);
    expect(await vault.listEntries()).toHaveLength(2);

    await expect(vault.toggleFavorite(personal.id)).resolves.toEqual({ favorite: true });
    expect((await vault.listEntries())[0]).toMatchObject({ id: personal.id, favorite: true });
    await expect(vault.updateEntry(work.id, { title: 'Updated work', category: 'admin', favorite: true })).resolves.toMatchObject({ title: 'Updated work', category: 'admin', favorite: true });
    expect(await vault.searchEntries('updated')).toEqual([expect.objectContaining({ id: work.id, title: 'Updated work' })]);
    expect(await vault.getStats()).toMatchObject({ entryCount: 2 });

    await expect(vault.deleteEntry(personal.id)).resolves.toBe(true);
    await expect(vault.deleteEntry(personal.id)).resolves.toBe(false);
    await expect(vault.getEntry(personal.id)).resolves.toBeNull();
    expect(vault.getStats()!.entryCount).toBe(1);
  });

  it('handles index metadata and traversal or locked failures', async () => {
    await init();
    await expect(vault.getEntry('../escape')).rejects.toThrow('Invalid entry ID');
    await expect(vault.getEntry('not-an-id')).rejects.toThrow('Invalid entry ID');
    await expect(vault.updateNoteEntry('../escape', { content: 'x' })).rejects.toThrow('Invalid entry ID');

    await vault.updateVaultIndex({ lastSync: 123 });
    expect(vault.getStats()).toMatchObject({ lastSync: 123 });
    vault.lock();
    await expect(vault.addEntry('locked', {})).rejects.toThrow('Vault is locked');
    await expect(vault.searchEntries('locked')).rejects.toThrow('Vault is locked');
    await expect(vault.listEntries()).rejects.toThrow('Vault is locked');
    await expect(vault.deleteEntry(validId)).rejects.toThrow('Vault is locked');
    await expect(vault.getFileData(validId)).rejects.toThrow('Vault is locked');
  });
});

describe('vault notes and 2FA', () => {
  it('creates, reads, updates, and lists secure notes', async () => {
    await init();
    const note = await vault.addNoteEntry('Recovery note', 'first body', true);
    await expect(vault.getNoteEntry(note.id)).resolves.toMatchObject({ title: 'Recovery note', content: 'first body', favorite: true });
    await expect(vault.getFileEntry(note.id)).resolves.toBeNull();
    await expect(vault.updateNoteEntry(note.id, { title: 'Updated note', content: 'second body', favorite: false })).resolves.toMatchObject({ title: 'Updated note', content: 'second body', favorite: false });
    await expect(vault.getNoteEntry(note.id)).resolves.toMatchObject({ title: 'Updated note', content: 'second body', favorite: false });
    expect(await vault.listEntries()).toEqual([expect.objectContaining({ id: note.id, entryType: 'note', title: 'Updated note', favorite: false })]);
  });

  it('sets, persists, uses, and clears vault 2FA backup codes', async () => {
    await init();
    expect(vault.getVault2FAConfig()).toBeUndefined();
    expect(vault.isVault2FAEnabled()).toBe(false);
    const config = { enabled: true, secret: 'ABCDEFGHIJKLMNOP', enabledAt: Date.now(), backupCodes: ['one', 'two'] };
    await vault.setVault2FAConfig(config);
    expect(vault.isVault2FAEnabled()).toBe(true);
    await vault.useBackupCode(0);
    expect(vault.getVault2FAConfig()!.backupCodes).toEqual(['two']);
    vault.lock();
    await vault.unlock(password);
    expect(vault.getVault2FAConfig()).toMatchObject({ enabled: true, backupCodes: ['two'] });
    await vault.setVault2FAConfig(undefined);
    expect(vault.isVault2FAEnabled()).toBe(false);
    expect(vault.getVault2FAConfig()).toBeUndefined();
  });
});

describe('vault file entries and payload compatibility', () => {
  it('encrypts and reads small files, verifies checksums, and accepts legacy payloads', async () => {
    await init();
    const data = Buffer.from('small file contents');
    const source = path.join(fixture.root, 'report.txt');
    await fs.writeFile(source, data);
    const progress: number[] = [];
    const entry = await vault.addFileEntry('Report', source, 'file notes', (done, total) => progress.push(done === total ? total : done));

    expect(entry).toMatchObject({ title: 'Report', originalName: 'report.txt', mimeType: 'text/plain', size: data.length, notes: 'file notes', checksum: sha256(data) });
    await expect(vault.getFileEntry(entry.id)).resolves.toMatchObject(entry);
    expect(await vault.getFileData(entry.id, (done) => progress.push(done))).toEqual(data);
    expect(progress.at(-1)).toBe(data.length);

    setChecksum(entry.id, sha256(data));
    await expect(vault.getFileData(entry.id)).resolves.toEqual(data);
    await fs.writeFile(tempFile(entry.id), encryptToBuffer(Buffer.alloc(data.length, 3), fixture.entryKey, entry.id));
    await expect(vault.getFileData(entry.id)).rejects.toThrow('checksum verification failed');

    await fs.writeFile(tempFile(entry.id), encryptToPayload(data, fixture.entryKey, entry.id));
    await expect(vault.getFileData(entry.id)).resolves.toEqual(data);

    await vault.cleanupTempFiles(entry.id, 1);
    await expect(fs.access(tempFile(entry.id))).rejects.toThrow();
    await expect(vault.getFileData(entry.id)).rejects.toThrow('Encrypted file data not found');
    await expect(vault.addFileEntry('missing', path.join(fixture.root, 'missing.bin'))).rejects.toThrow();
    expect(await fs.access(vaultFile(entry.id))).toBeUndefined();
  });

  it('reassembles chunked files, reports progress, verifies checksum, and detects missing chunks', async () => {
    await init();
    const first = Buffer.from('chunk one ');
    const second = Buffer.from('chunk two');
    const data = Buffer.concat([first, second]);
    const source = path.join(fixture.root, 'large.bin');
    await fs.writeFile(source, data);
    const entry = await vault.addFileEntry('Large', source);
    const indexEntry = vault.getVaultIndex()!.entries[entry.id];
    const entryKey = fixture.entryKey;
    const tempDir = vault.getTempFilesDir();

    indexEntry!.chunkCount = 2;
    indexEntry!.fileSize = data.length;
    setChecksum(entry.id, sha256(data));
    await fs.writeFile(path.join(tempDir, `${entry.id}_0.bin`), encryptToPayload(first, entryKey, `${entry.id}_chunk_0`));
    await fs.writeFile(path.join(tempDir, `${entry.id}_1.bin`), encryptToPayload(second, entryKey, `${entry.id}_chunk_1`));
    const progress: number[] = [];
    await expect(vault.getFileData(entry.id, (done) => progress.push(done))).resolves.toEqual(data);
    expect(progress).toEqual([first.length, data.length]);

    await fs.writeFile(path.join(tempDir, `${entry.id}_0.bin`), Buffer.from(encryptToPayload(first, entryKey, `${entry.id}_chunk_0`), 'utf8'));
    await expect(vault.getFileData(entry.id)).resolves.toEqual(data);
    await fs.unlink(path.join(tempDir, `${entry.id}_0.bin`));
    await expect(vault.getFileData(entry.id)).rejects.toThrow('Missing chunk file 1/2');
    await vault.cleanupTempFiles(entry.id, 2);
    await expect(fs.access(path.join(tempDir, `${entry.id}_1.bin`))).rejects.toThrow();
  });

  it('ignores cleanup failures and rejects corrupted or wrong entry data', async () => {
    await init();
    await expect(vault.cleanupTempFiles(validId, 1)).resolves.toBeUndefined();
    await expect(vault.getFileData(validId)).resolves.toBeNull();
    await expect(vault.getFileEntry(validId)).resolves.toBeNull();
    await expect(vault.getNoteEntry(validId)).resolves.toBeNull();
    await expect(vault.toggleFavorite(validId)).resolves.toBeNull();
  });
});

describe('vault formatting', () => {
  it('formats byte, kilobyte, megabyte, and gigabyte sizes', () => {
    expect(vault.formatFileSize(10)).toBe('10 B');
    expect(vault.formatFileSize(1024)).toBe('1.0 KB');
    expect(vault.formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(vault.formatFileSize(1024 * 1024 * 1024)).toBe('1.00 GB');
  });
});
