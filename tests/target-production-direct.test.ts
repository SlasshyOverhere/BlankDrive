import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PNG } from 'pngjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  generateDecoyImage,
  generateDecoys,
  generateDecoysByRatio,
  isDecoy,
} from '../src/obfuscation/decoyGenerator.js';
import {
  generateDecoyFilename,
  generateFilename,
  generateRandomTimestamp,
} from '../src/obfuscation/fileNameObfuscator.js';
import {
  calculateFragmentedSize,
  deserializeFragment,
  fragmentData,
  reassembleFragments,
  serializeFragment,
} from '../src/obfuscation/fragmenter.js';
import {
  assertSecureServerUrl,
  isHttpsOrLocalhostHttp,
  isLoopbackHost,
  parseHttpUrl,
} from '../src/security/urlValidation.js';
import {
  calculateCapacity,
  embedInPNG,
  extractFromPNG,
  getImageInfo,
  hasEmbeddedData,
} from '../src/steganography/png-stego.js';
import {
  copyCarrier,
  findBestCarrier,
  getTotalCapacity,
  scanForCarriers,
  validateCarrier,
} from '../src/steganography/carrier-manager.js';
import {
  ensureCarrierCapacity,
  generateCarrierImage,
  generateCarriers,
} from '../src/steganography/auto-carrier.js';
import {
  CloudChunkSchema,
  EntrySchema,
  FileEntrySchema,
  IndexEntrySchema,
  NoteEntrySchema,
  Vault2FAConfigSchema,
  VaultConfigSchema,
  VaultIndexSchema,
  createEmptyIndex,
  createEntry,
  createFileEntry,
  createNoteEntry,
  validateEntry,
  validateFileEntry,
  validateNoteEntry,
  validateVaultIndex,
} from '../src/storage/vault/schema.js';
import inquirer from 'inquirer';
import {
  calculateEntryChecksum,
  createInitialSyncState,
  detectConflicts,
  displaySyncSummary,
  resolveAllConflicts,
  resolveConflict,
  updateSyncState,
  type SyncConflict,
  type SyncState,
} from '../src/sync/conflictResolver.js';
import type { Entry, FileEntry, IndexEntry, NoteEntry } from '../src/storage/vault/schema.js';

afterEach(() => vi.restoreAllMocks());

function pngBuffer(width = 32, height = 32): Buffer {
  const png = new PNG({ width, height });
  png.data.fill(80);
  for (let i = 3; i < png.data.length; i += 4) png.data[i] = 255;
  return PNG.sync.write(png);
}

describe('obfuscation production modules', () => {
  it('fragments and reassembles data with serialized checksummed headers', () => {
    const data = Buffer.alloc(120_000, 9);
    const fragments = fragmentData(data, 100_000, 50_000);
    expect(fragments.length).toBeGreaterThan(1);
    const encoded = fragments.map(serializeFragment);
    expect(encoded.every((part, index) => deserializeFragment(part).index === index)).toBe(true);
    expect(reassembleFragments([...fragments].reverse())).toEqual(data);
    expect(calculateFragmentedSize(fragments)).toBe(encoded.reduce((n, b) => n + b.length, 0));
    expect(() => deserializeFragment(Buffer.alloc(15))).toThrow('too short');
    expect(() => deserializeFragment(encoded[0]!.subarray(0, encoded[0]!.length - 1))).toThrow('truncated');
    const corrupt = Buffer.from(encoded[0]!); corrupt[16] = corrupt[16]! ^ 1;
    expect(() => deserializeFragment(corrupt)).toThrow('checksum');
    expect(() => reassembleFragments([])).toThrow('No fragments');
    expect(() => reassembleFragments([{ ...fragments[0]!, total: fragments.length + 1 }])).toThrow('Missing fragments');
    expect(() => reassembleFragments([{ ...fragments[0]!, index: 1, total: 1 }])).toThrow('Missing fragment at index 0');
  });

  it('handles small data and generates realistic names/timestamps', () => {
    const data = Buffer.from('small');
    const one = fragmentData(data, 100, 100);
    expect(one).toHaveLength(1);
    expect(one[0]!.data).toBe(data);
    expect(generateFilename('jpg')).toMatch(/\.jpg$/);
    expect(generateDecoyFilename('png')).toMatch(/\.png$/);
    const timestamp = generateRandomTimestamp().getTime();
    expect(timestamp).toBeLessThanOrEqual(Date.now());
    expect(timestamp).toBeGreaterThan(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000 - 1000);
  });

  it('writes decoys, checks clean files, and honors ratios', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'blankdrive-decoy-'));
    try {
      const one = path.join(dir, 'one.png');
      await generateDecoyImage(one, 4, 3);
      expect(await isDecoy(one)).toBe(true);
      expect(await generateDecoys(dir, 1, 'png')).toHaveLength(1);
      expect(await generateDecoysByRatio(dir, 2, 0.5)).toHaveLength(1);
      expect(await generateDecoysByRatio(dir, 0)).toEqual([]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe('URL validation production module', () => {
  it('accepts strict loopback and rejects rebinding lookalikes', () => {
    for (const host of ['localhost', 'LOCALHOST', '127.0.0.1', '127.10.20.30', '[::1]']) expect(isLoopbackHost(host)).toBe(true);
    for (const host of ['127', '127.0', '127.0.0', '127.0.0.256', '127.0.0.1.evil', '::2']) expect(isLoopbackHost(host)).toBe(false);
  });

  it('validates HTTP(S), credentials, and remote HTTPS requirements', () => {
    expect(parseHttpUrl('https://example.test/a').pathname).toBe('/a');
    expect(parseHttpUrl('http://localhost:3000').port).toBe('3000');
    expect(() => parseHttpUrl('bad url')).toThrow('Invalid URL');
    expect(() => parseHttpUrl('ftp://example.test')).toThrow('Only http');
    expect(() => parseHttpUrl('https://user:pass@example.test')).toThrow('credentials');
    expect(isHttpsOrLocalhostHttp(new URL('https://remote.test'))).toBe(true);
    expect(isHttpsOrLocalhostHttp(new URL('http://localhost'))).toBe(true);
    expect(isHttpsOrLocalhostHttp(new URL('http://remote.test'))).toBe(false);
    expect(assertSecureServerUrl('https://remote.test', 'Backend').hostname).toBe('remote.test');
    expect(assertSecureServerUrl('http://127.0.0.1:9', 'Backend').port).toBe('9');
    expect(() => assertSecureServerUrl('http://remote.test', 'Backend')).toThrow('Backend must use HTTPS');
  });
});

describe('PNG and carrier production modules', () => {
  it('embeds, extracts, reports capacity, and detects data', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'blankdrive-stego-'));
    try {
      const input = path.join(dir, 'input.png');
      const output = path.join(dir, 'output.png');
      await fs.writeFile(input, pngBuffer());
      expect(calculateCapacity(32, 32)).toBe(368);
      expect(await getImageInfo(input)).toEqual({ width: 32, height: 32, capacity: 368 });
      expect(await hasEmbeddedData(input)).toBe(false);
      const embedded = await embedInPNG(input, Buffer.from('payload'), output);
      expect(embedded.bytesEmbedded).toBe(7);
      expect(await hasEmbeddedData(output)).toBe(true);
      expect(await extractFromPNG(output)).toMatchObject({ data: Buffer.from('payload'), checksum: embedded.checksum });
      const empty = path.join(dir, 'empty.png');
      await embedInPNG(input, Buffer.alloc(0), empty);
      expect((await extractFromPNG(empty)).data).toEqual(Buffer.alloc(0));
      await expect(embedInPNG(path.join(dir, 'tiny.png'), Buffer.alloc(1), path.join(dir, 'x.png'))).rejects.toBeTruthy();
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('scans, sorts, filters, copies, validates, and totals carriers', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'blankdrive-carrier-'));
    try {
      await fs.writeFile(path.join(dir, 'small.png'), pngBuffer(32, 32));
      await fs.writeFile(path.join(dir, 'large.PNG'), pngBuffer(64, 64));
      await fs.writeFile(path.join(dir, 'bad.png'), Buffer.from('bad'));
      await fs.writeFile(path.join(dir, 'ignore.txt'), Buffer.from('x'));
      const carriers = await scanForCarriers(dir, 1);
      expect(carriers).toHaveLength(2);
      expect(carriers[0]!.capacity).toBeGreaterThan(carriers[1]!.capacity);
      expect(await scanForCarriers(path.join(dir, 'missing'))).toEqual([]);
      expect(findBestCarrier(carriers, carriers[0]!.capacity)).toEqual(carriers[0]);
      expect(findBestCarrier(carriers, Number.MAX_SAFE_INTEGER)).toBeNull();
      expect(getTotalCapacity(carriers)).toBe(carriers[0]!.capacity + carriers[1]!.capacity);
      const copied = path.join(dir, 'copied.png'); await copyCarrier(carriers[0]!.path, copied);
      expect(await validateCarrier(copied)).toBe(true); expect(await validateCarrier(path.join(dir, 'bad.png'))).toBe(false);
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
  });

  it('generates carriers and ensures required capacity', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'blankdrive-auto-'));
    try {
      const first = await generateCarrierImage(path.join(dir, 'first.png'), 1);
      expect(first.capacity).toBeGreaterThan(0); expect(first.width).toBeGreaterThanOrEqual(800); expect(first.height).toBeGreaterThanOrEqual(600);
      const generated = await generateCarriers(path.join(dir, 'many'), 1, 1); expect(generated).toHaveLength(1);
      const enough = await ensureCarrierCapacity(dir, 1, [first]); expect(enough).toHaveLength(1);
      const more = await ensureCarrierCapacity(dir, first.capacity + 1, [first]); expect(more.length).toBeGreaterThan(1);
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
  });
});

describe('vault schema production module', () => {
  const now = 1_700_000_000_000;
  const base = { id: '550e8400-e29b-41d4-a716-446655440000', title: 'Entry', created: now, modified: now };
  it('creates and validates all entry types', () => {
    const entry = createEntry('Password', { username: 'u', password: 'p', url: 'https://example.test', notes: 'n', favorite: true, category: 'work', passwordExpiryDays: 30 });
    expect(entry.passwordLastChanged).toBeGreaterThan(0); expect(validateEntry(entry)).toEqual(entry);
    expect(createEntry('Empty', {}).passwordLastChanged).toBeUndefined();
    const file = createFileEntry('File', { originalName: 'a.txt', mimeType: 'text/plain', size: 0, checksum: 'sum' }); expect(validateFileEntry(file)).toEqual(file);
    const note = createNoteEntry('Note', 'contents', true); expect(validateNoteEntry(note)).toEqual(note);
  });
  it('covers schema defaults, optional fields, and rejection paths', () => {
    expect(EntrySchema.parse(base)).toMatchObject({ type: 'password', favorite: false });
    expect(NoteEntrySchema.parse({ ...base, type: 'note', content: '' }).favorite).toBe(false);
    expect(FileEntrySchema.parse({ ...base, type: 'file', originalName: 'x', mimeType: '', size: 0, checksum: '' }).favorite).toBe(false);
    expect(IndexEntrySchema.parse({ titleEncrypted: 'x', fragments: [], carrierType: 'decoy', created: now, modified: now })).toMatchObject({ entryType: 'password', favorite: false });
    expect(CloudChunkSchema.parse({ chunkIndex: 0, driveFileId: 'id', size: 0 })).toBeTruthy();
    expect(Vault2FAConfigSchema.parse({ enabled: false, secret: 'JBSWY3DPEHPK3PXP', enabledAt: now })).toBeTruthy();
    expect(VaultConfigSchema.parse({ vaultPath: '/v', carriersPath: '/c' })).toMatchObject({ autoLockTimeout: 300000, autoSync: false, decoyRatio: 2, preferredCarrier: 'png' });
    expect(() => validateEntry({ ...base, title: '' })).toThrow(); expect(() => validateFileEntry({ ...base, type: 'file', originalName: '', mimeType: '', size: -1, checksum: '' })).toThrow(); expect(() => validateNoteEntry({ ...base, type: 'password', content: '' })).toThrow();
    const index = createEmptyIndex('salt', 'hash'); expect(index.version).toBe('1.0.0'); expect(index.metadata.lastSync).toBeNull(); expect(VaultIndexSchema.parse(index)).toEqual(index); expect(() => validateVaultIndex({ ...index, metadata: { ...index.metadata, created: 0 } })).toThrow();
  });
});

function entry(id: string, title: string, modified: number, extra: Partial<Entry> = {}): Entry {
  return { id, type: 'password', title, username: 'u', password: 'p', favorite: false, created: 1, modified, ...extra };
}
function wrapped(value: Entry | FileEntry | NoteEntry) { return { entry: value, indexEntry: { titleEncrypted: 't', entryType: value.type, fragments: [], carrierType: 'png' as const, created: 1, modified: 1 } }; }
function syncState(id: string, lastSyncedAt: number): SyncState { return { entryVersions: { [id]: { localVersion: 1, remoteVersion: 1, lastSyncedAt, checksum: '' } }, lastFullSync: lastSyncedAt, conflictHistory: [] }; }

describe('sync conflict production module', () => {
  it('calculates checksums and detects modifications/deletions', () => {
    const local = entry('1', 'local', 200); const remote = entry('1', 'remote', 300);
    expect(calculateEntryChecksum(local)).toHaveLength(16); expect(calculateEntryChecksum(local)).toBe(calculateEntryChecksum({ ...local })); expect(calculateEntryChecksum(local)).not.toBe(calculateEntryChecksum({ ...local, password: 'changed' }));
    expect(detectConflicts({ '1': wrapped(local) }, { '1': wrapped(remote) }, syncState('1', 100))[0]).toMatchObject({ type: 'modified_both', localVersion: 2, remoteVersion: 2 });
    expect(detectConflicts({ '1': wrapped(local) }, {}, syncState('1', 100))[0]!.type).toBe('deleted_remote'); expect(detectConflicts({}, { '1': wrapped(remote) }, syncState('1', 100))[0]!.type).toBe('deleted_local');
    expect(detectConflicts({ new: wrapped(entry('new', 'new', 200)) }, {}, createInitialSyncState())).toEqual([]); expect(detectConflicts({}, { new: wrapped(entry('new', 'new', 200)) }, createInitialSyncState())).toEqual([]); expect(detectConflicts({ '1': wrapped(local) }, { '1': wrapped({ ...local }) }, syncState('1', 100))).toEqual([]);
  });

  it('resolves strategies and exercises interactive merge fields', async () => {
    const local = entry('1', 'local', 200, { username: 'lu', password: 'lp', url: 'lurl', notes: 'ln' });
    const remote = entry('1', 'remote', 300, { username: 'ru', password: 'rp', url: 'rurl', notes: 'rn', totp: { secret: 'JBSWY3DPEHPK3PXP' } });
    const conflict = (type: SyncConflict['type'] = 'modified_both'): SyncConflict => ({ id: '1', entryTitle: 'Entry', type, localEntry: local, remoteEntry: remote, localModified: 200, remoteModified: 300 });
    const prompt = vi.spyOn(inquirer, 'prompt');
    for (const strategy of ['keep_local', 'keep_remote', 'skip', 'delete'] as const) { prompt.mockResolvedValueOnce({ strategy }); const result = await resolveConflict(conflict(), 0, 1); expect(result.strategy).toBe(strategy); }
    prompt.mockResolvedValueOnce({ strategy: 'keep_newest' }); expect((await resolveConflict(conflict(), 0, 1)).resolvedEntry).toBe(remote);
    prompt.mockResolvedValueOnce({ strategy: 'keep_both' }); expect((await resolveConflict(conflict(), 0, 1)).resolvedEntry).toMatchObject({ title: 'remote (from cloud)' });
    prompt.mockResolvedValueOnce({ strategy: 'merge' }).mockResolvedValueOnce({ username: 'ru' }).mockResolvedValueOnce({ password: 'lp' }).mockResolvedValueOnce({ url: 'rurl' }).mockResolvedValueOnce({ notes: '__combine__' });
    expect((await resolveConflict(conflict(), 0, 1)).resolvedEntry).toMatchObject({ username: 'ru', password: 'lp', url: 'rurl', notes: expect.stringContaining('Merged from other device'), totp: remote.totp });
    prompt.mockResolvedValueOnce({ strategy: 'keep_local' }); await resolveConflict(conflict('created_both'), 0, 1); prompt.mockResolvedValueOnce({ strategy: 'keep_remote' }); await resolveConflict(conflict('schema_mismatch'), 0, 1);
  });

  it('resolves all, updates state, and prints summaries', async () => {
    const local = entry('1', 'local', 200); const remote = entry('1', 'remote', 300); const one: SyncConflict = { id: '1', entryTitle: 'one', type: 'modified_both', localEntry: local, remoteEntry: remote, localModified: 200, remoteModified: 300 }; const two = { ...one, id: '2', localModified: 400 };
    const prompt = vi.spyOn(inquirer, 'prompt').mockResolvedValueOnce({ resolveMode: 'all_local' }); expect((await resolveAllConflicts([one, two])).every(r => r.strategy === 'keep_local')).toBe(true);
    prompt.mockResolvedValueOnce({ resolveMode: 'all_remote' }); expect((await resolveAllConflicts([one, two]))[0]!.strategy).toBe('keep_remote'); prompt.mockResolvedValueOnce({ resolveMode: 'all_newest' }); expect((await resolveAllConflicts([one, two]))[0]!.strategy).toBe('keep_newest'); prompt.mockResolvedValueOnce({ resolveMode: 'individual' }).mockResolvedValueOnce({ strategy: 'skip' }).mockResolvedValueOnce({ strategy: 'delete' }); expect((await resolveAllConflicts([one, two])).map(r => r.strategy)).toEqual(['skip', 'delete']); expect(await resolveAllConflicts([])).toEqual([]);
    const initial = createInitialSyncState(); const updated = updateSyncState(initial, '1', local, true); expect(updated.entryVersions['1']).toMatchObject({ localVersion: 1, remoteVersion: 0 }); const remoteUpdated = updateSyncState(updated, '1', remote, false); expect(remoteUpdated.entryVersions['1']).toMatchObject({ localVersion: 1, remoteVersion: 1 });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined); displaySyncSummary((['keep_local', 'keep_remote', 'keep_newest', 'keep_both', 'merge', 'delete', 'skip'] as const).map(strategy => ({ conflict: one, strategy, timestamp: 1 }))); expect(log).toHaveBeenCalled();
  });
});
