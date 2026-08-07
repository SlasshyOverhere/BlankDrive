import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ root: `/tmp/vault-remaining-${process.pid}-${Date.now()}`, unlocked: false, indexKey: Buffer.alloc(32, 1), entryKey: Buffer.alloc(32, 2) }));
vi.mock('os', () => ({ default: { homedir: () => fixture.root, tmpdir: () => fixture.root } }));
vi.mock('../src/crypto/index.js', async () => {
  const actual = await vi.importActual<typeof import('../src/crypto/index.js')>('../src/crypto/index.js');
  return { ...actual, initializeKeyManager: vi.fn(), createVault: vi.fn(async () => { fixture.unlocked = true; return { salt: Buffer.alloc(32, 9), keyHash: Buffer.alloc(32, 8) }; }), unlockVault: vi.fn(async (password: string) => { if (password !== 'password') throw new Error('bad password'); fixture.unlocked = true; }), lockVault: vi.fn(() => { fixture.unlocked = false; }), isVaultUnlocked: vi.fn(() => fixture.unlocked), getIndexKey: vi.fn(() => fixture.indexKey), getEntryKey: vi.fn(() => fixture.entryKey) };
});
import { encryptToBuffer, encryptToPayload } from '../src/crypto/encryption.js';
import * as vault from '../src/storage/vault/vaultManager.js';

const id = '00000000-0000-4000-8000-000000000000';
const digest = (data: Buffer) => crypto.createHash('sha256').update(data).digest('hex');
const temp = (entryId: string, index?: number) => path.join(vault.getTempFilesDir(), index === undefined ? `${entryId}.bin` : `${entryId}_${index}.bin`);

describe('Vault manager remaining direct branches', () => {
  beforeEach(async () => { vault.lock(); await fs.rm(fixture.root, { recursive: true, force: true }); await fs.mkdir(fixture.root, { recursive: true }); });

  it('covers legacy init, duplicate init, invalid format, failed re-unlock, and no-index guards', async () => {
    await vault.initVaultWithHeader('password');
    expect(vault.isUnlocked()).toBe(true);
    await expect(vault.initVault('password')).rejects.toThrow('already exists');
    vault.lock();
    await expect(vault.unlock('bad')).rejects.toThrow('bad password');
    expect(vault.isUnlocked()).toBe(false);
    const index = vault.getVaultPaths().index;
    await fs.writeFile(index, 'invalid-format');
    await expect(vault.unlock('password')).rejects.toThrow('Invalid vault format');
    vault.lock();
    await expect(vault.updateVaultIndex({ lastSync: 1 })).rejects.toThrow('No vault loaded');
    await expect(vault.setVault2FAConfig(undefined)).rejects.toThrow('No vault loaded');
    await expect(vault.useBackupCode(0)).rejects.toThrow('No backup codes available');
  });

  it('covers missing entry files, decrypt skips, index sorting, and file/note missing paths', async () => {
    await vault.initVaultWithHeader('password');
    await vault.unlock('password');
    await expect(vault.getEntry(id)).resolves.toBeNull();
    await expect(vault.getFileEntry(id)).resolves.toBeNull();
    await expect(vault.getNoteEntry(id)).resolves.toBeNull();
    await expect(vault.searchEntries('anything')).resolves.toEqual([]);
    await expect(vault.listEntries()).resolves.toEqual([]);
    await expect(vault.getFileData(id)).resolves.toBeNull();
    await expect(vault.updateEntry(id, {})).resolves.toBeNull();
    await expect(vault.updateNoteEntry(id, {})).resolves.toBeNull();
    await expect(vault.toggleFavorite(id)).resolves.toBeNull();
    await expect(vault.deleteEntry(id)).resolves.toBe(false);
  });

  it('covers chunk creation/progress and checksum verification for chunked data', async () => {
    await vault.initVaultWithHeader('password');
    await vault.unlock('password');
    const source = path.join(fixture.root, 'data.txt');
    const data = Buffer.from('chunk-data');
    await fs.writeFile(source, data);
    const entry = await vault.addFileEntry('Data', source);
    const index = vault.getVaultIndex()!.entries[entry.id]!;
    index.chunkCount = 2;
    index.fileSize = data.length;
    (index as { checksum?: string }).checksum = digest(data);
    await fs.writeFile(temp(entry.id, 0), encryptToPayload(Buffer.from('chunk-'), fixture.entryKey, `${entry.id}_chunk_0`));
    await fs.writeFile(temp(entry.id, 1), encryptToBuffer(Buffer.from('data'), fixture.entryKey, `${entry.id}_chunk_1`));
    await expect(vault.getFileData(entry.id)).resolves.toEqual(data);
    (index as { checksum?: string }).checksum = 'wrong';
    await expect(vault.getFileData(entry.id)).rejects.toThrow('checksum verification failed');
    await vault.cleanupTempFiles(entry.id, 2);
  });
});
