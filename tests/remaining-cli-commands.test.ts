import { beforeEach, describe, expect, it, vi } from 'vitest';

const prompt = vi.hoisted(() => vi.fn());
const spinner = vi.hoisted(() => ({
  start: vi.fn(function () { return spinner; }),
  stop: vi.fn(),
  succeed: vi.fn(),
  fail: vi.fn(),
  warn: vi.fn(),
  bar: { stop: vi.fn() },
  text: '',
}));
const fs = vi.hoisted(() => ({
  stat: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));
const fsSync = vi.hoisted(() => ({ createWriteStream: vi.fn() }));
const https = vi.hoisted(() => ({ request: vi.fn(), get: vi.fn() }));
const spawn = vi.hoisted(() => vi.fn());
const vault = vi.hoisted(() => ({
  vaultExists: vi.fn().mockResolvedValue(true),
  initVault: vi.fn().mockResolvedValue(undefined),
  unlock: vi.fn().mockResolvedValue(undefined),
  isUnlocked: vi.fn(() => true),
  getVaultPaths: vi.fn(() => ({ dir: '/vault', index: '/vault/index.enc' })),
  addEntry: vi.fn().mockResolvedValue({ id: 'new', title: 'New' }),
  addFileEntry: vi.fn().mockResolvedValue({ id: 'file-new', title: 'file', originalName: 'file', size: 4, mimeType: 'text/plain' }),
  addNoteEntry: vi.fn().mockResolvedValue({ id: 'note-new', title: 'Note', content: 'content' }),
  getEntry: vi.fn(),
  getNoteEntry: vi.fn(),
  listEntries: vi.fn(),
  searchEntries: vi.fn(),
  updateEntry: vi.fn().mockResolvedValue({ id: 'e1', title: 'Updated' }),
  updateNoteEntry: vi.fn().mockResolvedValue({ id: 'n1', title: 'Updated note', content: 'new' }),
  deleteEntry: vi.fn().mockResolvedValue(undefined),
  toggleFavorite: vi.fn().mockResolvedValue({ favorite: true }),
  getVaultIndex: vi.fn(),
  updateVaultIndex: vi.fn().mockResolvedValue(undefined),
  cleanupTempFiles: vi.fn().mockResolvedValue(undefined),
}));
const drive = vi.hoisted(() => ({
  isAuthenticated: vi.fn().mockResolvedValue(true),
  authenticateDrive: vi.fn().mockResolvedValue(undefined),
  performOAuthFlow: vi.fn().mockResolvedValue(undefined),
  isGoogleOAuthConfigured: vi.fn().mockResolvedValue(true),
  setGoogleOAuthCredentials: vi.fn().mockResolvedValue(undefined),
  setGoogleOAuthCredentialsForSession: vi.fn(),
  persistCurrentGoogleTokens: vi.fn().mockResolvedValue(undefined),
  getCloudStorageMode: vi.fn().mockResolvedValue('hidden'),
  setCloudStorageMode: vi.fn().mockResolvedValue(undefined),
  isCloudStorageModeConfigured: vi.fn().mockResolvedValue(true),
  getPublicContentFolderName: vi.fn().mockResolvedValue('vault-data'),
  isPublicContentFolderNameConfigured: vi.fn().mockResolvedValue(true),
  setPublicContentFolderName: vi.fn().mockResolvedValue(undefined),
  findAppDataFile: vi.fn().mockResolvedValue(null),
  downloadAppDataToBuffer: vi.fn().mockResolvedValue(Buffer.from('backup')),
  hasAppDataAccess: vi.fn().mockResolvedValue(true),
  listAppDataFiles: vi.fn().mockResolvedValue([]),
  deleteFromAppData: vi.fn().mockResolvedValue(undefined),
  runParallel: vi.fn(async (tasks: Array<() => Promise<void>>) => Promise.all(tasks.map(task => task()))),
  PARALLEL_LIMIT: 4,
  deleteFileFromCloud: vi.fn().mockResolvedValue(undefined),
  uploadFileToCloud: vi.fn().mockResolvedValue([{ id: 'chunk' }]),
  isDriveConnected: vi.fn(() => true),
}));
const crypto = vi.hoisted(() => ({
  initializeKeyManager: vi.fn(),
  generatePassword: vi.fn(() => 'Generated!123'),
  generatePassphrase: vi.fn(() => 'word-word-word'),
  analyzePassword: vi.fn(() => ({ strength: 'fair', score: 40, entropy: 30, feedback: ['Use more symbols'] })),
  PASSWORD_PRESETS: { strong: {}, standard: {}, alphanumeric: {}, memorable: {}, pin: {} },
}));
const prompts = vi.hoisted(() => ({
  promptPassword: vi.fn().mockResolvedValue('password'),
  promptPasswordConfirm: vi.fn().mockResolvedValue('password'),
  promptConfirm: vi.fn().mockResolvedValue(true),
  promptSelectEntry: vi.fn().mockResolvedValue('e1'),
  promptEntryDetails: vi.fn(),
}));
const ensure = vi.hoisted(() => ({ ensureAuthenticated: vi.fn().mockResolvedValue(true) }));
const duress = vi.hoisted(() => ({ isInDuressMode: vi.fn(() => false), getDecoyEntries: vi.fn(() => []) }));
const audit = vi.hoisted(() => ({ logAuditEvent: vi.fn().mockResolvedValue(undefined) }));
const cloudSetup = vi.hoisted(() => ({
  promptCloudStorageMode: vi.fn().mockResolvedValue('public'),
  promptPublicContentFolderName: vi.fn().mockResolvedValue('shared'),
}));
const oauthSetup = vi.hoisted(() => ({ promptGoogleOAuthCredentials: vi.fn().mockResolvedValue({ clientId: 'id', clientSecret: 'secret' }) }));
const progress = vi.hoisted(() => ({
  createProgressTracker: vi.fn(() => ({ setProgress: vi.fn(), finish: vi.fn(), bar: { stop: vi.fn() } })),
  formatBytes: vi.fn((n: number) => `${n} B`),
}));
const totp = vi.hoisted(() => ({
  generateTOTPCodeSync: vi.fn(() => '123456'),
  validateTOTPSecret: vi.fn(() => true),
  cleanTOTPSecret: vi.fn((s: string) => s.replace(/\s/g, '')),
  parseOTPAuthURI: vi.fn(() => null),
  displayTOTPCode: vi.fn(),
  getTimeRemaining: vi.fn(() => 20),
}));
const sync = vi.hoisted(() => ({
  createInitialSyncState: vi.fn(() => ({ entryVersions: {}, conflictHistory: [], lastFullSync: undefined })),
  detectConflicts: vi.fn(() => []),
  resolveAllConflicts: vi.fn().mockResolvedValue([]),
  displaySyncSummary: vi.fn(),
  updateSyncState: vi.fn(),
  calculateEntryChecksum: vi.fn(() => 'checksum'),
}));

vi.mock('inquirer', () => ({ default: { prompt } }));
vi.mock('ora', () => ({ default: vi.fn(() => spinner) }));
vi.mock('fs/promises', () => ({ default: fs }));
vi.mock('fs', () => ({ default: fsSync }));
vi.mock('https', () => ({ default: https }));
vi.mock('child_process', () => ({ spawn, exec: vi.fn() }));
vi.mock('clipboardy', () => ({ default: { write: vi.fn().mockResolvedValue(undefined), read: vi.fn().mockResolvedValue(''), writeSync: vi.fn() } }));
vi.mock('../src/storage/vault/index.js', () => vault);
vi.mock('../src/storage/drive/index.js', () => drive);
vi.mock('../src/storage/drive/driveClient.js', () => drive);
vi.mock('../src/storage/drive/synchronizer.js', () => ({ getSyncStatus: vi.fn(() => ({ connected: true, pendingUploads: 0, lastSync: undefined })) }));
vi.mock('../src/crypto/index.js', () => crypto);
vi.mock('../src/cli/prompts.js', () => prompts);
vi.mock('../src/cli/ensureAuth.js', () => ensure);
vi.mock('../src/cli/duress.js', () => duress);
vi.mock('../src/cli/auditLog.js', () => audit);
vi.mock('../src/cli/cloudStorageSetup.js', () => cloudSetup);
vi.mock('../src/cli/googleOAuthSetup.js', () => oauthSetup);
vi.mock('../src/cli/openExternal.js', () => ({ openExternalUrl: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../src/cli/progress.js', () => progress);
vi.mock('../src/cli/totp.js', () => totp);
vi.mock('../src/sync/index.js', () => sync);

import { deleteCommand } from '../src/cli/commands/delete.js';
import { destructCommand } from '../src/cli/commands/destruct.js';
import { editCommand } from '../src/cli/commands/edit.js';
import { favoriteCommand, listFavoritesCommand } from '../src/cli/commands/favorite.js';
import { generateCommand, quickGenerate } from '../src/cli/commands/generate.js';
import { getCommand } from '../src/cli/commands/get.js';
import { initCommand } from '../src/cli/commands/init.js';
import { listCommand } from '../src/cli/commands/list.js';
import { noteAddCommand, noteEditCommand, noteListCommand, noteViewCommand } from '../src/cli/commands/note.js';
import { syncCommand } from '../src/cli/commands/sync.js';
import { totpCommand } from '../src/cli/commands/totp.js';
import { updateCommand } from '../src/cli/commands/update.js';
import { uploadCommand } from '../src/cli/commands/upload.js';

const passwordEntry: any = { id: 'e1', title: 'Example', username: 'user', password: 'secret', url: 'https://example.test', notes: 'notes', favorite: false, modified: 1, created: 1, entryType: 'password' };
const fileEntry: any = { id: 'f1', title: 'File', originalName: 'file.bin', size: 4, mimeType: 'application/octet-stream', favorite: false, modified: 1, created: 1, entryType: 'file' };
const noteEntry: any = { id: 'n1', title: 'Note', content: 'body', favorite: true, modified: 1, created: 1, entryType: 'note' };

function releaseResponse(body: unknown, statusCode = 200): any {
  const response: any = {
    statusCode,
    headers: {},
    on: vi.fn((event: string, cb: (chunk?: Buffer) => void) => {
      if (event === 'data') cb(Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)));
      if (event === 'end') cb();
      return response;
    }),
    resume: vi.fn(),
  };
  return response;
}

function requestHandle(): any {
  return { on: vi.fn(), setTimeout: vi.fn(), end: vi.fn(), destroy: vi.fn() };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  prompt.mockReset();
  prompt.mockResolvedValue({});
  vault.vaultExists.mockResolvedValue(true);
  vault.isUnlocked.mockReturnValue(true);
  vault.listEntries.mockResolvedValue([passwordEntry, fileEntry, noteEntry]);
  vault.searchEntries.mockResolvedValue([passwordEntry]);
  vault.getEntry.mockImplementation(async (id: string) => ({ e1: passwordEntry, f1: fileEntry, n1: noteEntry }[id]));
  vault.getNoteEntry.mockResolvedValue(noteEntry);
  vault.getVaultIndex.mockReturnValue({ entries: { e1: { entryType: 'password' }, f1: { entryType: 'file', cloudChunks: ['c1'], chunkCount: 1, fileSize: 4, mimeType: 'application/octet-stream' }, n1: { entryType: 'note' } } });
  vault.updateEntry.mockResolvedValue({ id: 'e1', title: 'Updated' });
  vault.updateNoteEntry.mockResolvedValue({ id: 'n1', title: 'Updated note', content: 'new' });
  drive.isAuthenticated.mockResolvedValue(true);
  drive.isDriveConnected.mockReturnValue(true);
  drive.getCloudStorageMode.mockResolvedValue('hidden');
  drive.isCloudStorageModeConfigured.mockResolvedValue(true);
  drive.isPublicContentFolderNameConfigured.mockResolvedValue(true);
  drive.findAppDataFile.mockResolvedValue(null);
  drive.hasAppDataAccess.mockResolvedValue(true);
  ensure.ensureAuthenticated.mockResolvedValue(true);
  duress.isInDuressMode.mockReturnValue(false);
  prompts.promptConfirm.mockResolvedValue(true);
  prompts.promptSelectEntry.mockResolvedValue('e1');
  fs.stat.mockRejectedValue(new Error('missing'));
  fs.readFile.mockRejectedValue(new Error('missing'));
  https.request.mockReset();
  https.get.mockReset();
});

describe('remaining direct CLI command branches', () => {
  it('covers delete numeric selection, cloud cancellation, local errors, and empty query', async () => {
    await deleteCommand();
    expect(vault.deleteEntry).not.toHaveBeenCalled();

    prompt.mockResolvedValueOnce({ targetType: 'file' });
    vault.searchEntries.mockResolvedValueOnce([fileEntry]);
    await deleteCommand('1', { force: true });
    expect(drive.deleteFileFromCloud).toHaveBeenCalledWith('f1', ['c1']);
    expect(vault.deleteEntry).toHaveBeenCalledWith('f1');

    drive.deleteFileFromCloud.mockRejectedValueOnce(new Error('cloud down'));
    prompt.mockResolvedValueOnce({ proceedLocal: false });
    await deleteCommand('1', { force: true });
    expect(vault.deleteEntry).toHaveBeenCalledTimes(2);

    vault.searchEntries.mockRejectedValueOnce(new Error('search down'));
    await deleteCommand('Example');
    vault.searchEntries.mockResolvedValueOnce([passwordEntry]);
    vault.deleteEntry.mockRejectedValueOnce(new Error('disk full'));
    await deleteCommand('Example', { force: true });
    expect(spinner.fail).toHaveBeenCalled();
  });

  it('keeps desktop installer functionality removed', async () => {
    await expect(import('../src/cli/commands/desktop.js')).rejects.toThrow();
  });

  it('covers destruct successful cleanup and refuses local cleanup after cloud failure', async () => {
    vi.useFakeTimers();
    prompt.mockResolvedValueOnce({ confirmation: 'DESTROY' });
    drive.listAppDataFiles.mockResolvedValueOnce([
      { id: 'backup', name: 'slasshy_vault_index_backup.enc' },
      { id: 'chunk', name: 'slasshy_123_chunk_1.bin' },
      { id: 'ignored', name: 'other.txt' },
    ]);
    const success = destructCommand();
    await Promise.resolve();
    vi.advanceTimersByTime(500);
    await success;
    expect(drive.deleteFromAppData).toHaveBeenCalledTimes(2);
    expect(fs.rm).toHaveBeenCalled();
    expect(fs.unlink).toHaveBeenCalled();

    prompt.mockResolvedValueOnce({ confirmation: 'DESTROY' });
    drive.listAppDataFiles.mockRejectedValueOnce(new Error('offline'));
    await destructCommand();
    expect(fs.rm).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('covers edit unlock/list/update failures, cancellation, and generated password', async () => {
    vault.isUnlocked.mockReturnValueOnce(false);
    vault.unlock.mockRejectedValueOnce(new Error('bad password'));
    await editCommand('Example');

    vault.listEntries.mockResolvedValueOnce([{ ...fileEntry, id: 'file_1' }]);
    await editCommand();
    vault.listEntries.mockResolvedValueOnce([passwordEntry]);
    prompts.promptSelectEntry.mockResolvedValueOnce(null);
    await editCommand();

    prompt.mockImplementation(async (questions: Array<{ name: string }>) => {
      const names = questions.map(q => q.name);
      if (names.includes('fields')) return { fields: ['password'] };
      if (names.includes('action')) return { action: 'generate_strong' };
      if (names.includes('confirm')) return { confirm: 'yes' };
      return { confirm: false };
    });
    vault.searchEntries.mockResolvedValueOnce([passwordEntry]);
    vault.updateEntry.mockResolvedValueOnce(null);
    await editCommand('Example');
    expect(vault.updateEntry).toHaveBeenCalled();

    vault.searchEntries.mockResolvedValueOnce([passwordEntry]);
    prompt.mockImplementation(async (questions: Array<{ name: string }>) => {
      const names = questions.map(q => q.name);
      if (names.includes('fields')) return { fields: ['title'] };
      if (names.includes('title')) return { title: 'Changed' };
      if (names.includes('confirm')) return { confirm: false };
      return {};
    });
    await editCommand('Example');
  });

  it('covers favorite missing, unlock/load errors, selection cancellation, and empty favorites', async () => {
    vault.vaultExists.mockResolvedValueOnce(false);
    await favoriteCommand('Example');
    vault.isUnlocked.mockReturnValueOnce(false);
    vault.unlock.mockRejectedValueOnce(new Error('bad password'));
    await favoriteCommand('Example');
    vault.listEntries.mockRejectedValueOnce(new Error('read failed'));
    await favoriteCommand();
    vault.listEntries.mockResolvedValueOnce([passwordEntry, noteEntry]);
    prompts.promptSelectEntry.mockResolvedValueOnce(null);
    await favoriteCommand();
    vault.listEntries.mockResolvedValueOnce([{ ...passwordEntry, favorite: false }]);
    await listFavoritesCommand();
    vault.listEntries.mockRejectedValueOnce(new Error('favorites failed'));
    await listFavoritesCommand();
    expect(spinner.fail).toHaveBeenCalled();
  });

  it('covers generator interactive modes, clipboard failure, and quick regeneration', async () => {
    const clipboard = await import('clipboardy');
    (clipboard.default.writeSync as ReturnType<typeof vi.fn>).mockImplementationOnce(() => { throw new Error('no clipboard'); });
    await generateCommand({ length: 12, noSymbols: false, copy: true });

    prompt.mockResolvedValueOnce({ mode: 'passphrase' }).mockResolvedValueOnce({ wordCount: 4, separator: '_' }).mockResolvedValueOnce({ copy: false, regenerate: false });
    await generateCommand({});
    prompt.mockResolvedValueOnce({ mode: 'password' }).mockResolvedValueOnce({ length: 10, charTypes: ['uppercase'], excludeAmbiguous: true }).mockResolvedValueOnce({ copy: false, regenerate: false });
    await generateCommand({});

    prompt.mockResolvedValueOnce({ action: 'passphrase' }).mockResolvedValueOnce({ confirm: false }).mockResolvedValueOnce({ action: 'manual' });
    await expect(quickGenerate()).resolves.toBeNull();
    expect(crypto.generatePassphrase).toHaveBeenCalled();
  });

  it('covers get unlock/search/multiple-selection and missing-entry branches', async () => {
    vault.isUnlocked.mockReturnValueOnce(false);
    vault.unlock.mockRejectedValueOnce(new Error('unlock failed'));
    await getCommand('Example');
    vault.listEntries.mockRejectedValueOnce(new Error('search failed'));
    await getCommand('Example');
    vault.listEntries.mockResolvedValueOnce([passwordEntry, { ...passwordEntry, id: 'e2', title: 'Example Two' }]);
    prompt.mockResolvedValueOnce({ selectedId: '' });
    await getCommand('Example');
    vault.listEntries.mockResolvedValueOnce([passwordEntry]);
    vault.getEntry.mockResolvedValueOnce(null);
    await getCommand('Example');
    expect(spinner.fail).toHaveBeenCalled();
  });

  it('covers init creation failure, storage setup errors, and restore early failures', async () => {
    vault.vaultExists.mockResolvedValueOnce(false);
    vault.initVault.mockRejectedValueOnce(new Error('cannot create'));
    await initCommand({});

    vault.vaultExists.mockResolvedValueOnce(false);
    drive.isCloudStorageModeConfigured.mockResolvedValueOnce(false);
    drive.setCloudStorageMode.mockRejectedValueOnce(new Error('settings unavailable'));
    await initCommand({});

    vault.vaultExists.mockResolvedValueOnce(true);
    await initCommand({ restore: true });
    vault.vaultExists.mockResolvedValueOnce(false);
    drive.isCloudStorageModeConfigured.mockResolvedValueOnce(true);
    drive.getCloudStorageMode.mockResolvedValueOnce('hidden');
    drive.authenticateDrive.mockRejectedValueOnce(new Error('auth failed'));
    drive.isGoogleOAuthConfigured.mockResolvedValueOnce(false);
    drive.performOAuthFlow.mockRejectedValueOnce(new Error('oauth failed'));
    await initCommand({ restore: true });
    expect(drive.authenticateDrive).toHaveBeenCalled();
  });

  it('covers list duress, type/category/title filters, and loading failure', async () => {
    duress.isInDuressMode.mockReturnValueOnce(true);
    duress.getDecoyEntries.mockReturnValueOnce([{ title: 'Decoy' }]);
    await listCommand();
    await listCommand({ type: 'passwords', category: 'work', filter: 'example' });
    vault.listEntries.mockRejectedValueOnce(new Error('list failed'));
    await listCommand();
    expect(spinner.fail).toHaveBeenCalled();
  });

  it('covers note add/view/edit/list cancellations and errors', async () => {
    vault.addNoteEntry.mockRejectedValueOnce(new Error('save failed'));
    prompt.mockResolvedValueOnce({ title: 'N' }).mockResolvedValueOnce({ content: 'body' });
    await noteAddCommand();

    vault.listEntries.mockResolvedValueOnce([]);
    await noteViewCommand();
    vault.listEntries.mockResolvedValueOnce([noteEntry]);
    vault.getNoteEntry.mockResolvedValueOnce(null);
    await noteViewCommand('Note');

    vault.listEntries.mockResolvedValueOnce([noteEntry]);
    prompt.mockResolvedValueOnce({ editChoice: 'content' }).mockResolvedValueOnce({ newContent: 'changed' });
    vault.updateNoteEntry.mockRejectedValueOnce(new Error('update failed'));
    await noteEditCommand('Note');

    vault.listEntries.mockRejectedValueOnce(new Error('list failed'));
    await noteListCommand();
    expect(spinner.fail).toHaveBeenCalled();
  });

  it('covers sync status/conflicts, disconnected and conflict resolution errors', async () => {
    await syncCommand({ status: true });
    await syncCommand({ conflicts: true });
    drive.isDriveConnected.mockReturnValueOnce(false);
    await syncCommand({ force: true });

    sync.detectConflicts.mockReturnValueOnce([{ id: 'e1', entryTitle: 'Example', type: 'both_modified', localModified: 1, remoteModified: 2, localVersion: 1, remoteVersion: 2 }]);
    sync.resolveAllConflicts.mockResolvedValueOnce([
      { strategy: 'keep_remote', conflict: { id: 'e1', entryTitle: 'Example', localVersion: 1, remoteVersion: 2, type: 'both_modified', localModified: 1 }, resolvedEntry: passwordEntry },
      { strategy: 'keep_both', conflict: { id: 'e1', entryTitle: 'Example', localVersion: 1, remoteVersion: 2, type: 'both_modified', localModified: 1 }, resolvedEntry: passwordEntry },
      { strategy: 'delete', conflict: { id: 'e1', entryTitle: 'Example', localVersion: 1, remoteVersion: 2, type: 'both_modified', localModified: 1 } },
      { strategy: 'skip', conflict: { id: 'e1', entryTitle: 'Example', localVersion: 1, remoteVersion: 2, type: 'both_modified', localModified: 1 } },
    ]);
    vault.updateEntry.mockRejectedValueOnce(new Error('remote update failed'));
    await syncCommand();
    expect(sync.displaySyncSummary).toHaveBeenCalled();
  });

  it('covers TOTP add/view/remove/list cancellation and failures', async () => {
    const withTotp = { ...passwordEntry, totp: { secret: 'SECRET', issuer: 'Example' } };
    vault.getEntry.mockResolvedValue(withTotp);
    prompt.mockResolvedValueOnce({ replace: false });
    await totpCommand('add', 'Example');
    prompt.mockResolvedValueOnce({ input: 'SECRET' }).mockResolvedValueOnce({ issuer: 'Example' }).mockResolvedValueOnce({ confirm: false });
    await totpCommand('add', 'Example');

    vault.getEntry.mockResolvedValue({ ...passwordEntry });
    await totpCommand('view', 'Example', { copy: true });
    vault.getEntry.mockResolvedValue(withTotp);
    totp.generateTOTPCodeSync.mockImplementationOnce(() => { throw new Error('bad secret'); });
    await totpCommand('view', 'Example');
    prompt.mockResolvedValueOnce({ confirm: false });
    await totpCommand('remove', 'Example');
    vault.listEntries.mockRejectedValueOnce(new Error('totp list failed'));
    await totpCommand('list');
    expect(spinner.fail).toHaveBeenCalled();
  });

  it('covers update scheduled skip, JSON install success/failure, and interactive cancellation', async () => {
    fs.readFile.mockResolvedValueOnce(JSON.stringify({ lastCheckedAt: new Date().toISOString() }));
    await updateCommand({ scheduled: true, currentVersion: '0.1.0' });

    https.request.mockImplementationOnce((_options: unknown, cb: (response: any) => void) => { cb(releaseResponse({ version: '9.9.9' })); return requestHandle(); });
    spawn.mockImplementationOnce(() => { const child = { once: vi.fn((event: string, cb: (arg?: any) => void) => { if (event === 'close') cb(0); }), unref: vi.fn() }; return child; });
    await updateCommand({ json: true, install: true, currentVersion: '0.1.0' });

    https.request.mockImplementationOnce(() => { const req = requestHandle(); req.on.mockImplementation((event: string, cb: (error: Error) => void) => { if (event === 'error') cb(new Error('npm down')); return req; }); return req; });
    await updateCommand({ json: true, currentVersion: '0.1.0' });

    https.request.mockImplementationOnce((_options: unknown, cb: (response: any) => void) => { cb(releaseResponse({ version: '9.9.9' })); return requestHandle(); });
    prompt.mockResolvedValueOnce({ installNow: false });
    await updateCommand({ currentVersion: '0.1.0' });
  });

  it('covers upload browse cancellation, non-file, encryption, and cloud failures', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    ensure.ensureAuthenticated.mockResolvedValueOnce(false);
    await uploadCommand('/tmp/file');

    ensure.ensureAuthenticated.mockResolvedValueOnce(true);
    prompt.mockResolvedValueOnce({ switchToPublic: false });
    await uploadCommand('browse');

    fs.stat.mockResolvedValueOnce({ isFile: () => false, size: 10 });
    await uploadCommand('/tmp/directory');

    fs.stat.mockResolvedValue({ isFile: () => true, size: 4 });
    prompt.mockResolvedValueOnce({ title: 'file', notes: '' });
    vault.addFileEntry.mockRejectedValueOnce(new Error('encrypt failed'));
    await uploadCommand('/tmp/file');

    vault.addFileEntry.mockResolvedValueOnce({ id: 'file-new', title: 'file', originalName: 'file', size: 4, mimeType: 'text/plain' });
    drive.uploadFileToCloud.mockRejectedValueOnce(new Error('cloud upload failed'));
    await uploadCommand('/tmp/file');
    expect(vault.addFileEntry).toHaveBeenCalled();
  });
});
