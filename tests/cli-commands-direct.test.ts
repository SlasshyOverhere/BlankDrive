import { beforeEach, describe, expect, it, vi } from 'vitest';

const spinner = vi.hoisted(() => ({
  start: vi.fn(function () { return spinner; }),
  stop: vi.fn(),
  succeed: vi.fn(),
  fail: vi.fn(),
  warn: vi.fn(),
  text: '',
  bar: { stop: vi.fn() },
}));
const prompt = vi.hoisted(() => vi.fn());
const clipboard = vi.hoisted(() => ({
  write: vi.fn().mockResolvedValue(undefined),
  read: vi.fn().mockResolvedValue(''),
  writeSync: vi.fn(),
}));
const fsPromises = vi.hoisted(() => ({
  stat: vi.fn().mockRejectedValue(new Error('missing')),
  readFile: vi.fn().mockRejectedValue(new Error('missing')),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  rm: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));
const fsMock = vi.hoisted(() => ({
  createWriteStream: vi.fn(),
}));
const vault = vi.hoisted(() => ({
  vaultExists: vi.fn().mockResolvedValue(true),
  initVault: vi.fn().mockResolvedValue(undefined),
  unlock: vi.fn().mockResolvedValue(undefined),
  lock: vi.fn(),
  isUnlocked: vi.fn(() => true),
  addEntry: vi.fn().mockResolvedValue({ id: 'new', title: 'New entry' }),
  addFileEntry: vi.fn().mockResolvedValue({ id: 'file-new', title: 'upload.bin' }),
  addNoteEntry: vi.fn().mockResolvedValue({ id: 'note-new', title: 'New note', content: 'body' }),
  getEntry: vi.fn(),
  getFileEntry: vi.fn(),
  getNoteEntry: vi.fn(),
  searchEntries: vi.fn(),
  listEntries: vi.fn(),
  updateEntry: vi.fn().mockResolvedValue({ id: 'e1', title: 'Updated' }),
  updateNoteEntry: vi.fn().mockResolvedValue({ id: 'n1', title: 'Updated note', content: 'new' }),
  deleteEntry: vi.fn().mockResolvedValue(undefined),
  toggleFavorite: vi.fn().mockResolvedValue({ favorite: true }),
  getStats: vi.fn().mockReturnValue({ entryCount: 2, created: 1, lastSync: undefined }),
  getVaultPaths: vi.fn().mockReturnValue({ dir: '/vault', entries: '/vault/entries', carriers: '/vault/carriers' }),
  getVaultIndex: vi.fn(),
  updateVaultIndex: vi.fn().mockResolvedValue(undefined),
  cleanupTempFiles: vi.fn().mockResolvedValue(undefined),
  getVault2FAConfig: vi.fn().mockReturnValue(null),
  isVault2FAEnabled: vi.fn().mockReturnValue(false),
  setVault2FAConfig: vi.fn().mockResolvedValue(undefined),
  useBackupCode: vi.fn().mockResolvedValue(undefined),
}));
const drive = vi.hoisted(() => ({
  isAuthenticated: vi.fn().mockResolvedValue(true),
  authenticateDrive: vi.fn().mockResolvedValue(undefined),
  performOAuthFlow: vi.fn().mockResolvedValue(undefined),
  setGoogleOAuthCredentials: vi.fn().mockResolvedValue(undefined),
  setGoogleOAuthCredentialsForSession: vi.fn(),
  getGoogleOAuthCredentials: vi.fn().mockResolvedValue(null),
  isGoogleOAuthConfigured: vi.fn().mockResolvedValue(true),
  getCloudStorageMode: vi.fn().mockResolvedValue('hidden'),
  setCloudStorageMode: vi.fn().mockResolvedValue(undefined),
  isCloudStorageModeConfigured: vi.fn().mockResolvedValue(true),
  getPublicContentFolderName: vi.fn().mockResolvedValue('vault-data'),
  setPublicContentFolderName: vi.fn().mockResolvedValue(undefined),
  isPublicContentFolderNameConfigured: vi.fn().mockResolvedValue(true),
  persistCurrentGoogleTokens: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  isDriveConnected: vi.fn(() => true),
  disconnectDrive: vi.fn(),
  uploadFileToCloud: vi.fn().mockResolvedValue([{ id: 'chunk' }]),
  streamDownloadToFile: vi.fn().mockResolvedValue(undefined),
  deleteFileFromCloud: vi.fn().mockResolvedValue(undefined),
  isCloudSyncAvailable: vi.fn().mockResolvedValue(true),
  getParallelismInfo: vi.fn(() => ({ level: 2, memoryMB: 1024 })),
  listAppDataFiles: vi.fn().mockResolvedValue([]),
  deleteFromAppData: vi.fn().mockResolvedValue(undefined),
  runParallel: vi.fn(async (tasks: Array<() => Promise<void>>) => Promise.all(tasks.map(task => task()))),
  PARALLEL_LIMIT: 5,
  getSyncStatus: vi.fn(() => ({ connected: true, pendingUploads: 0, lastSync: undefined })),
  findAppDataFile: vi.fn().mockResolvedValue(null),
  downloadAppDataToBuffer: vi.fn().mockResolvedValue(Buffer.from('backup')),
  hasAppDataAccess: vi.fn().mockResolvedValue(true),
}));
const crypto = vi.hoisted(() => ({
  initializeKeyManager: vi.fn(),
  getIndexKey: vi.fn(() => Buffer.alloc(32)),
  getEntryKey: vi.fn(() => Buffer.alloc(32)),
  generatePassword: vi.fn(() => 'Generated!123'),
  generatePassphrase: vi.fn(() => 'word-word-word'),
  analyzePassword: vi.fn(() => ({ strength: 'strong', score: 80, entropy: 70, feedback: [] })),
  PASSWORD_PRESETS: { strong: { length: 24 }, standard: { length: 16 }, alphanumeric: { length: 16 }, memorable: { length: 12 }, pin: { length: 6 } },
}));
const prompts = vi.hoisted(() => ({
  promptPassword: vi.fn().mockResolvedValue('password'),
  promptPasswordConfirm: vi.fn().mockResolvedValue('password'),
  promptEntryDetails: vi.fn().mockResolvedValue({ title: 'New entry', username: 'user', password: 'secret', url: 'https://example.test', notes: 'notes' }),
  promptConfirm: vi.fn().mockResolvedValue(true),
  promptSelectEntry: vi.fn().mockResolvedValue('e1'),
}));
const duress = vi.hoisted(() => ({ isInDuressMode: vi.fn(() => false), getDecoyEntries: vi.fn(() => [{ id: 'd1', title: 'Decoy', username: 'decoy', favorite: false, modified: 1 }]) }));
const audit = vi.hoisted(() => ({ logAuditEvent: vi.fn().mockResolvedValue(undefined), resetAuditState: vi.fn(), displayAuditLog: vi.fn().mockResolvedValue(undefined) }));
const ensure = vi.hoisted(() => ({ ensureAuthenticated: vi.fn().mockResolvedValue(true) }));
const cloudPrompts = vi.hoisted(() => ({
  promptCloudStorageMode: vi.fn().mockResolvedValue('hidden'),
  promptPublicContentFolderName: vi.fn().mockResolvedValue('vault-data'),
  describeCloudStorageMode: vi.fn((mode: string) => mode),
}));
const oauthPrompts = vi.hoisted(() => ({
  promptGoogleOAuthCredentials: vi.fn().mockResolvedValue({ clientId: 'id', clientSecret: 'secret' }),
  maskGoogleClientId: vi.fn((id: string) => `masked:${id}`),
}));
const progress = vi.hoisted(() => ({
  createProgressTracker: vi.fn(() => ({ setProgress: vi.fn(), finish: vi.fn(), bar: { stop: vi.fn() } })),
  formatBytes: vi.fn((bytes: number) => `${bytes} B`),
}));
const totpUtils = vi.hoisted(() => ({
  generateTOTPCodeSync: vi.fn(() => '123456'),
  validateTOTPSecret: vi.fn(() => true),
  cleanTOTPSecret: vi.fn((value: string) => value.replace(/\s/g, '')),
  parseOTPAuthURI: vi.fn(() => ({ secret: 'JBSWY3DPEHPK3PXP', issuer: 'Test', algorithm: 'SHA1', digits: 6, period: 30 })),
  displayTOTPCode: vi.fn(),
  getTimeRemaining: vi.fn(() => 20),
}));
const syncUtils = vi.hoisted(() => ({
  createInitialSyncState: vi.fn(() => ({ entryVersions: {}, conflictHistory: [], lastFullSync: undefined })),
  detectConflicts: vi.fn(() => []),
  resolveAllConflicts: vi.fn().mockResolvedValue([]),
  displaySyncSummary: vi.fn(),
  updateSyncState: vi.fn(),
  calculateEntryChecksum: vi.fn(() => 'checksum'),
}));
const webServer = vi.hoisted(() => ({ startWebUiServer: vi.fn().mockResolvedValue({ url: 'http://localhost:4310', close: vi.fn().mockResolvedValue(undefined) }) }));
const httpsMock = vi.hoisted(() => ({
  request: vi.fn(),
  get: vi.fn(),
}));
const spawnMock = vi.hoisted(() => vi.fn());

vi.mock('ora', () => ({ default: vi.fn(() => spinner) }));
vi.mock('inquirer', () => ({ default: { prompt, Separator: class Separator { constructor(public line: string) {} } } }));
vi.mock('clipboardy', () => ({ default: clipboard }));
vi.mock('fs/promises', () => ({ default: fsPromises }));
vi.mock('fs', () => ({ default: fsMock }));
vi.mock('https', () => ({ default: httpsMock }));
vi.mock('child_process', () => ({ spawn: spawnMock, exec: vi.fn() }));
vi.mock('../src/storage/vault/index.js', () => vault);
vi.mock('../src/storage/drive/index.js', () => drive);
vi.mock('../src/storage/drive/driveClient.js', () => drive);
vi.mock('../src/storage/drive/synchronizer.js', () => ({ getSyncStatus: vi.fn(() => ({ connected: true, pendingUploads: 0, lastSync: undefined })) }));
vi.mock('../src/crypto/index.js', () => crypto);
vi.mock('../src/cli/prompts.js', () => prompts);
vi.mock('../src/cli/duress.js', () => duress);
vi.mock('../src/cli/auditLog.js', () => audit);
vi.mock('../src/cli/ensureAuth.js', () => ensure);
vi.mock('../src/cli/cloudStorageSetup.js', () => cloudPrompts);
vi.mock('../src/cli/googleOAuthSetup.js', () => oauthPrompts);
vi.mock('../src/cli/openExternal.js', () => ({ openExternalUrl: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../src/cli/progress.js', () => progress);
vi.mock('../src/cli/totp.js', () => totpUtils);
vi.mock('../src/cli/passwordStrength.js', () => ({ getStrengthSummary: vi.fn(() => 'strong'), getScoreColor: vi.fn((x: string) => x), getStrengthColor: vi.fn((x: string) => x) }));
vi.mock('../src/sync/index.js', () => syncUtils);
vi.mock('../src/webui/server.js', () => webServer);

import { addCommand } from '../src/cli/commands/add.js';
import { auditCommand, checkPasswordExpiry } from '../src/cli/commands/audit.js';
import { authCommand } from '../src/cli/commands/auth.js';
import { deleteCommand } from '../src/cli/commands/delete.js';
import { desktopCommand, downloadDesktopRelease, getDesktopReleaseInfo, isNewerVersion, launchDesktopInstaller } from '../src/cli/commands/desktop.js';
import { destructCommand } from '../src/cli/commands/destruct.js';
import { downloadCommand } from '../src/cli/commands/download.js';
import { editCommand } from '../src/cli/commands/edit.js';
import { favoriteCommand, listFavoritesCommand } from '../src/cli/commands/favorite.js';
import { generateCommand, quickGenerate } from '../src/cli/commands/generate.js';
import { getCommand } from '../src/cli/commands/get.js';
import { initCommand } from '../src/cli/commands/init.js';
import { listCommand } from '../src/cli/commands/list.js';
import { lockCommand } from '../src/cli/commands/lock.js';
import { noteAddCommand, noteCommand, noteEditCommand, noteListCommand, noteViewCommand } from '../src/cli/commands/note.js';
import { settingsCommand } from '../src/cli/commands/settings.js';
import { statusCommand } from '../src/cli/commands/status.js';
import { showSyncHelp, syncCommand } from '../src/cli/commands/sync.js';
import { totpCommand } from '../src/cli/commands/totp.js';
import { updateCommand } from '../src/cli/commands/update.js';
import { uploadCommand } from '../src/cli/commands/upload.js';
import { webCommand } from '../src/cli/commands/web.js';
import * as commandIndex from '../src/cli/commands/index.js';

type AnyEntry = Record<string, any>;
const passwordEntry: AnyEntry = { id: 'e1', title: 'Example', username: 'user', password: 'secret', url: 'https://example.test', notes: 'note', favorite: false, modified: 1, created: 1, entryType: 'password' };
const fileEntry: AnyEntry = { id: 'f1', title: 'File', originalName: '../../bad<>:"/evil?.txt', mimeType: 'text/plain', size: 5, favorite: false, modified: 1, created: 1, entryType: 'file' };
const noteEntry: AnyEntry = { id: 'n1', title: 'Note', content: 'body', favorite: true, modified: 1, created: 1, entryType: 'note' };

function setStandardData(): void {
  vault.listEntries.mockResolvedValue([passwordEntry, fileEntry, noteEntry]);
  vault.searchEntries.mockResolvedValue([passwordEntry]);
  vault.getEntry.mockImplementation(async (id: string) => id === 'e1' ? passwordEntry : id === 'f1' ? fileEntry : noteEntry);
  vault.getFileEntry.mockResolvedValue(fileEntry);
  vault.getNoteEntry.mockResolvedValue(noteEntry);
  vault.getVaultIndex.mockReturnValue({ entries: {
    e1: { entryType: 'password' },
    f1: { entryType: 'file', fileSize: 5, mimeType: 'text/plain', cloudChunks: ['chunk-1'] },
    n1: { entryType: 'note' },
  } });
}

beforeEach(() => {
  vi.clearAllMocks();
  prompt.mockReset();
  vault.vaultExists.mockResolvedValue(true);
  vault.isUnlocked.mockReturnValue(true);
  drive.isAuthenticated.mockResolvedValue(true);
  drive.isDriveConnected.mockReturnValue(true);
  drive.isCloudSyncAvailable.mockResolvedValue(true);
  ensure.ensureAuthenticated.mockResolvedValue(true);
  duress.isInDuressMode.mockReturnValue(false);
  prompts.promptConfirm.mockResolvedValue(true);
  prompts.promptSelectEntry.mockResolvedValue('e1');
  prompt.mockResolvedValue({});
  fsPromises.stat.mockRejectedValue(new Error('missing'));
  setStandardData();
});

describe('direct CLI command coverage', () => {
  it('covers add success, missing vault, unlock failure, and duress paths', async () => {
    await addCommand();
    expect(vault.addEntry).toHaveBeenCalled();

    vault.vaultExists.mockResolvedValueOnce(false);
    await addCommand();
    expect(vault.addEntry).toHaveBeenCalledTimes(1);

    vault.isUnlocked.mockReturnValueOnce(false);
    vault.unlock.mockRejectedValueOnce(new Error('bad password'));
    await addCommand();
    expect(vault.unlock).toHaveBeenCalled();

    duress.isInDuressMode.mockReturnValueOnce(true);
    await addCommand();
    expect(vault.addEntry).toHaveBeenCalledTimes(1);
  });

  it('covers audit and password-expiry branches', async () => {
    expect(checkPasswordExpiry({ password: 'secret', passwordLastChanged: Date.now() - 100 * 86400000 } as any)).toContain('expired');
    expect(checkPasswordExpiry({ password: 'secret', passwordLastChanged: Date.now() } as any)).toBeNull();
    vault.vaultExists.mockResolvedValueOnce(false);
    await auditCommand();
    vault.vaultExists.mockResolvedValueOnce(true);
    await auditCommand({ all: true });
    expect(vault.listEntries).toHaveBeenCalled();
  });

  it('covers authentication logout, missing vault, and OAuth errors', async () => {
    await authCommand({ logout: true });
    expect(drive.logout).toHaveBeenCalled();

    vault.vaultExists.mockResolvedValueOnce(false);
    await authCommand();

    drive.isCloudStorageModeConfigured.mockResolvedValueOnce(true);
    drive.isAuthenticated.mockResolvedValueOnce(false);
    drive.performOAuthFlow.mockRejectedValueOnce(new Error('redirect_uri_mismatch'));
    await authCommand();
    expect(drive.performOAuthFlow).toHaveBeenCalled();
  });

  it('covers delete cancellation, invalid query, and success', async () => {
    await deleteCommand();
    prompts.promptConfirm.mockResolvedValueOnce(false);
    await deleteCommand('Example');
    expect(vault.deleteEntry).not.toHaveBeenCalled();
    prompts.promptConfirm.mockResolvedValueOnce(true);
    await deleteCommand('Example', { force: true });
    expect(vault.deleteEntry).toHaveBeenCalledWith('e1');
  });

  it('covers desktop version selection and download cancellation/error', async () => {
    expect(isNewerVersion('v1.2.0', '1.1.9')).toBe(true);
    expect(isNewerVersion('1.2.0', 'v1.2.0')).toBe(false);

    const releaseBody = JSON.stringify({ tag_name: 'v1.0.0', assets: [{ name: 'BlankDrive-x64.exe', size: 3, browser_download_url: 'https://github.com/SlasshyOverhere/BlankDrive/releases/download/v1.0.0/BlankDrive-x64.exe' }] });
    const response = { statusCode: 200, headers: {}, on: (event: string, cb: (chunk?: Buffer) => void) => { if (event === 'data') cb(Buffer.from(releaseBody)); if (event === 'end') cb(); return response; } };
    const checksumResponse = { statusCode: 200, headers: {}, on: (event: string, cb: (chunk?: Buffer) => void) => { if (event === 'data') cb(Buffer.from('0'.repeat(64) + '  BlankDrive-x64.exe.sha256')); if (event === 'end') cb(); return checksumResponse; } };
    const requestWithRelease = () => ({ on: vi.fn(), setTimeout: vi.fn(), end: vi.fn() });
    httpsMock.request
      .mockImplementationOnce((_options: unknown, cb: (res: unknown) => void) => { cb(response); return requestWithRelease(); })
      .mockImplementationOnce((_options: unknown, cb: (res: unknown) => void) => { cb(response); return requestWithRelease(); });
    await expect(getDesktopReleaseInfo()).resolves.toMatchObject({ assetName: 'BlankDrive-x64.exe' });

    fsPromises.stat.mockResolvedValue({ isDirectory: () => false, isFile: () => true });
    prompt.mockResolvedValue({ overwrite: false });
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
    await expect(downloadDesktopRelease({ output: '/tmp/app.exe' })).rejects.toThrow('cancelled');
    // download (release body on https.get), then checksum fetch (https.get)
    // returns a bogus digest, so the installed file fails signature verification.
    const downloadStream = {
      on: vi.fn((evt: string, cb: () => void) => { if (evt === 'finish') setImmediate(() => cb()); return downloadStream; }),
      destroy: vi.fn(), write: vi.fn(() => true), end: vi.fn(),
      close: vi.fn((cb: () => void) => setImmediate(() => cb())),
    };
    fsMock.createWriteStream.mockReturnValue(downloadStream);
    (response as unknown as { pipe: unknown }).pipe = () => downloadStream;
    const downloadReq = { on: vi.fn(), setTimeout: vi.fn(), end: vi.fn(), destroy: vi.fn() };
    const checksumReq = { on: vi.fn(), setTimeout: vi.fn(), end: vi.fn(), destroy: vi.fn() };
    httpsMock.get
      .mockImplementationOnce((_options: unknown, cb: (res: unknown) => void) => { cb(response); return downloadReq; })
      .mockImplementationOnce((_options: unknown, cb: (res: unknown) => void) => { cb(checksumResponse); return checksumReq; });
    fsPromises.readFile.mockResolvedValue(Buffer.from(releaseBody));
    httpsMock.request
      .mockImplementationOnce((_options: unknown, cb: (res: unknown) => void) => { cb(response); return requestWithRelease(); });
    await expect(downloadDesktopRelease({ quiet: true, install: true })).rejects.toThrow('signature verification');
    fsPromises.readFile.mockRejectedValue(new Error('missing'));
    fsMock.createWriteStream.mockReset();
    httpsMock.get.mockReset();
  });

  it('covers destruct confirmation cancellation and cloud protection', async () => {
    prompts.promptConfirm.mockResolvedValueOnce(false);
    await destructCommand();
    expect(fsPromises.rm).not.toHaveBeenCalled();

    prompts.promptConfirm.mockResolvedValueOnce(true);
    prompt.mockResolvedValueOnce({ confirmation: 'nope' });
    await destructCommand();

    prompts.promptConfirm.mockResolvedValueOnce(true);
    prompt.mockResolvedValueOnce({ confirmation: 'DESTROY' });
    drive.isAuthenticated.mockResolvedValueOnce(true);
    drive.listAppDataFiles.mockRejectedValueOnce(new Error('cloud unavailable'));
    await destructCommand();
    expect(fsPromises.rm).not.toHaveBeenCalled();
  });

  it('covers download duress/auth/file selection, sanitization, and cancellation', async () => {
    duress.isInDuressMode.mockReturnValueOnce(true);
    await downloadCommand('anything');

    ensure.ensureAuthenticated.mockResolvedValueOnce(false);
    await downloadCommand('File');

    prompt.mockResolvedValue({ outputPath: '/tmp/evil_.txt', overwrite: false });
    await downloadCommand('1');
    expect(drive.streamDownloadToFile).toHaveBeenCalledWith('f1', ['chunk-1'], expect.stringContaining('evil_.txt'), expect.anything(), expect.any(Function));

    fsPromises.stat.mockResolvedValueOnce({ isDirectory: () => false, isFile: () => true });
    prompt.mockImplementationOnce(async (questions: Array<{ name: string }>) => questions[0]?.name === 'overwrite' ? { overwrite: false } : { outputPath: '/tmp/existing.txt' });
    await downloadCommand('File');
    expect(drive.streamDownloadToFile).toHaveBeenCalledTimes(2);
  });

  it('covers edit and favorite cancellation and success', async () => {
    vault.searchEntries.mockResolvedValueOnce([]);
    await editCommand('missing');
    vault.searchEntries.mockResolvedValueOnce([passwordEntry, { ...passwordEntry, id: 'e2', title: 'Another' }]);
    prompts.promptSelectEntry.mockResolvedValueOnce(null);
    await editCommand('Example');

    prompt.mockImplementation(async (questions: Array<{ name: string }>) => {
      const names = questions.map(question => question.name);
      if (names.includes('fields')) return { fields: ['title'] };
      if (names.includes('title')) return { title: 'Renamed' };
      if (names.includes('confirm')) return { confirm: true };
      return {};
    });
    vault.searchEntries.mockResolvedValueOnce([passwordEntry]);
    await editCommand('Example');
    expect(vault.updateEntry).toHaveBeenCalled();

    prompts.promptConfirm.mockResolvedValueOnce(false);
    await favoriteCommand('Example');
    await favoriteCommand('Example');
    await listFavoritesCommand();
    expect(vault.toggleFavorite).toHaveBeenCalled();
  });

  it('covers generator option branches and quick-generation cancellation', async () => {
    await generateCommand({ passphrase: true, words: 4, copy: true });
    await generateCommand({ preset: 'strong' });
    await generateCommand({ length: 10, noSymbols: true });
    prompt.mockResolvedValueOnce({ action: 'manual' });
    await expect(quickGenerate()).resolves.toBeNull();
    prompt.mockResolvedValueOnce({ action: 'generate' }).mockResolvedValueOnce({ confirm: false }).mockResolvedValueOnce({ action: 'manual' });
    await expect(quickGenerate()).resolves.toBeNull();
    expect(clipboard.writeSync).toHaveBeenCalled();
  });

  it('covers get no-match, display, copy, and clipboard failure', async () => {
    vault.vaultExists.mockResolvedValueOnce(false);
    await getCommand('Example');
    vault.listEntries.mockResolvedValueOnce([]);
    await getCommand('missing');
    vault.listEntries.mockResolvedValueOnce([passwordEntry]);
    await getCommand('Example', { showPassword: true, copy: true });
    expect(clipboard.write).toHaveBeenCalledWith('secret');
    clipboard.write.mockRejectedValueOnce(new Error('clipboard'));
    await getCommand('Example', { copy: true });
  });

  it('covers init existing, cancelled, and successful initialization', async () => {
    await initCommand({});
    vault.vaultExists.mockResolvedValueOnce(false);
    prompts.promptPasswordConfirm.mockRejectedValueOnce(new Error('cancelled'));
    await initCommand({});
    vault.vaultExists.mockResolvedValueOnce(false);
    await initCommand({ drive: true });
    expect(vault.initVault).toHaveBeenCalledWith('password');
  });

  it('covers list filters, empty result, and lock/status branches', async () => {
    await listCommand({ type: 'file', category: 'none' });
    await listCommand({ type: 'files' });
    ensure.ensureAuthenticated.mockResolvedValueOnce(false);
    await listCommand();

    vault.vaultExists.mockResolvedValueOnce(false);
    await statusCommand();
    vault.vaultExists.mockResolvedValueOnce(true);
    await statusCommand();

    vault.isUnlocked.mockReturnValueOnce(false);
    await lockCommand();
    vault.isUnlocked.mockReturnValueOnce(true);
    await lockCommand();
    expect(drive.disconnectDrive).toHaveBeenCalled();
  });

  it('covers all note exports and dispatcher paths', async () => {
    prompt.mockImplementation(async (questions: Array<{ name: string }>) => {
      const name = questions[0]?.name;
      if (name === 'title') return { title: 'New note' };
      if (name === 'content') return { content: 'body' };
      return {};
    });
    await noteAddCommand();
    await noteViewCommand('Note');
    prompt.mockImplementation(async (questions: Array<{ name: string }>) => {
      const name = questions[0]?.name;
      if (name === 'editChoice') return { editChoice: 'title' };
      if (name === 'newTitle') return { newTitle: 'Renamed note' };
      return {};
    });
    await noteEditCommand('Note');
    await noteListCommand();
    await noteCommand('add');
    await noteCommand('view', 'Note');
    await noteCommand('list');
    await noteCommand();
    expect(vault.addNoteEntry).toHaveBeenCalled();
    expect(vault.updateNoteEntry).toHaveBeenCalled();
  });

  it('covers settings validation/no-op/change and sync help/status/connection branches', async () => {
    await settingsCommand({ storage: 'invalid' });
    await settingsCommand({ folder: 'bad/name' });
    await settingsCommand({ storage: 'hidden' });
    await settingsCommand({ storage: 'public', folder: 'shared' });
    expect(drive.setCloudStorageMode).toHaveBeenCalledWith('public');
    expect(drive.setPublicContentFolderName).toHaveBeenCalledWith('shared');

    showSyncHelp();
    ensure.ensureAuthenticated.mockResolvedValueOnce(false);
    await syncCommand();
    ensure.ensureAuthenticated.mockResolvedValueOnce(true);
    await syncCommand({ status: true });
    drive.isDriveConnected.mockReturnValueOnce(false);
    await syncCommand({ force: true });
  });

  it('covers TOTP help, add cancellation, view/list/remove paths', async () => {
    duress.isInDuressMode.mockReturnValueOnce(true);
    await totpCommand();
    ensure.ensureAuthenticated.mockResolvedValueOnce(false);
    await totpCommand('list');
    ensure.ensureAuthenticated.mockResolvedValueOnce(true);
    prompt.mockImplementation(async (questions: Array<{ name: string }>) => {
      const name = questions[0]?.name;
      if (name === 'input') return { input: 'JBSWY3DPEHPK3PXP' };
      if (name === 'issuer') return { issuer: 'Example' };
      if (name === 'confirm') return { confirm: false };
      return {};
    });
    await totpCommand('add', 'Example');
    await totpCommand('view', 'Example', { copy: true });
    await totpCommand('list');
    await totpCommand('remove', 'Example');
    expect(totpUtils.generateTOTPCodeSync).toHaveBeenCalled();
  });

  it('covers upload auth cancellation and duress missing-file paths', async () => {
    duress.isInDuressMode.mockReturnValueOnce(true);
    await uploadCommand('/missing');
    ensure.ensureAuthenticated.mockResolvedValueOnce(false);
    await uploadCommand('/tmp/file');
    prompt.mockImplementation(async (questions: Array<{ name: string }>) => {
      const names = questions.map(question => question.name);
      if (names.includes('inputPath')) return { inputPath: 'browse' };
      if (names.includes('switchToPublic')) return { switchToPublic: false };
      return {};
    });
    await uploadCommand();
    expect(drive.uploadFileToCloud).not.toHaveBeenCalled();
  });

  it('covers web startup, invalid port, and startup failure', async () => {
    await webCommand({ port: '4310', open: true });
    await expect(webCommand({ port: '0' })).rejects.toThrow('Port must be a number');
    webServer.startWebUiServer.mockRejectedValueOnce(new Error('busy'));
    await webCommand();
    expect(webServer.startWebUiServer).toHaveBeenCalled();
  });

  it('covers update JSON/no-update and npm request error handling', async () => {
    const response = { statusCode: 200, on: (event: string, cb: (chunk?: Buffer) => void) => { if (event === 'data') cb(Buffer.from('{"version":"0.1.5"}')); if (event === 'end') cb(); return response; } };
    httpsMock.request.mockImplementationOnce((_options: unknown, cb: (res: unknown) => void) => { cb(response); return { on: vi.fn(), setTimeout: vi.fn(), end: vi.fn() }; });
    await updateCommand({ json: true, currentVersion: '0.1.5' });
    httpsMock.request.mockImplementationOnce(() => { const req = { on: vi.fn((event: string, cb: (error: Error) => void) => { if (event === 'error') cb(new Error('network')); return req; }), setTimeout: vi.fn(), end: vi.fn() }; return req; });
    await updateCommand({ check: true, currentVersion: '0.1.0' });
    expect(fsPromises.writeFile).toHaveBeenCalled();
  });

  it('keeps the barrel exports wired to every command module', () => {
    expect(typeof commandIndex.addCommand).toBe('function');
    expect(typeof commandIndex.updateCommand).toBe('function');
    expect(typeof commandIndex.showSyncHelp).toBe('function');
    expect(typeof commandIndex.quickGenerate).toBe('function');
  });
});
