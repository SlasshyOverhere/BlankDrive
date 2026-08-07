import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const prompt = vi.hoisted(() => vi.fn());
const spinner = vi.hoisted(() => ({ start: vi.fn(function () { return spinner; }), stop: vi.fn(), succeed: vi.fn(), fail: vi.fn(), warn: vi.fn(), bar: { stop: vi.fn() }, text: '' }));
const fs = vi.hoisted(() => ({ stat: vi.fn(), readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn(), rm: vi.fn(), unlink: vi.fn() }));
const fsSync = vi.hoisted(() => ({ createWriteStream: vi.fn() }));
const https = vi.hoisted(() => ({ request: vi.fn(), get: vi.fn() }));
const spawn = vi.hoisted(() => vi.fn());
const clipboard = vi.hoisted(() => ({ write: vi.fn(), read: vi.fn(), writeSync: vi.fn() }));
const vault = vi.hoisted(() => ({
  vaultExists: vi.fn(), initVault: vi.fn(), unlock: vi.fn(), isUnlocked: vi.fn(),
  getVaultPaths: vi.fn(), getVaultIndex: vi.fn(), listEntries: vi.fn(), searchEntries: vi.fn(),
  getEntry: vi.fn(), getFileEntry: vi.fn(), getNoteEntry: vi.fn(), addEntry: vi.fn(),
  addFileEntry: vi.fn(), addNoteEntry: vi.fn(), updateEntry: vi.fn(), updateNoteEntry: vi.fn(),
  deleteEntry: vi.fn(), toggleFavorite: vi.fn(), updateVaultIndex: vi.fn(), cleanupTempFiles: vi.fn(),
}));
const drive = vi.hoisted(() => ({
  isAuthenticated: vi.fn(), authenticateDrive: vi.fn(), performOAuthFlow: vi.fn(), logout: vi.fn(),
  isGoogleOAuthConfigured: vi.fn(), getGoogleOAuthCredentials: vi.fn(), setGoogleOAuthCredentials: vi.fn(),
  setGoogleOAuthCredentialsForSession: vi.fn(), persistCurrentGoogleTokens: vi.fn(),
  getCloudStorageMode: vi.fn(), setCloudStorageMode: vi.fn(), isCloudStorageModeConfigured: vi.fn(),
  getPublicContentFolderName: vi.fn(), isPublicContentFolderNameConfigured: vi.fn(), setPublicContentFolderName: vi.fn(),
  findAppDataFile: vi.fn(), downloadAppDataToBuffer: vi.fn(), hasAppDataAccess: vi.fn(), listAppDataFiles: vi.fn(), deleteFromAppData: vi.fn(),
  deleteFileFromCloud: vi.fn(), uploadFileToCloud: vi.fn(), streamDownloadToFile: vi.fn(), isCloudSyncAvailable: vi.fn(),
  getParallelismInfo: vi.fn(), isDriveConnected: vi.fn(), runParallel: vi.fn(),
}));
const crypto = vi.hoisted(() => ({ initializeKeyManager: vi.fn(), getEntryKey: vi.fn(), generatePassword: vi.fn(), generatePassphrase: vi.fn(), analyzePassword: vi.fn(), PASSWORD_PRESETS: { strong: {} } }));
const prompts = vi.hoisted(() => ({ promptPassword: vi.fn(), promptPasswordConfirm: vi.fn(), promptConfirm: vi.fn(), promptSelectEntry: vi.fn(), promptEntryDetails: vi.fn() }));
const ensure = vi.hoisted(() => ({ ensureAuthenticated: vi.fn() }));
const duress = vi.hoisted(() => ({ isInDuressMode: vi.fn(), getDecoyEntries: vi.fn() }));
const auditLog = vi.hoisted(() => ({ logAuditEvent: vi.fn() }));
const cloudSetup = vi.hoisted(() => ({ promptCloudStorageMode: vi.fn(), promptPublicContentFolderName: vi.fn() }));
const oauthSetup = vi.hoisted(() => ({ promptGoogleOAuthCredentials: vi.fn(), maskGoogleClientId: vi.fn() }));
const progress = vi.hoisted(() => ({ createProgressTracker: vi.fn(), formatBytes: vi.fn() }));
const totp = vi.hoisted(() => ({ generateTOTPCodeSync: vi.fn(), validateTOTPSecret: vi.fn(), cleanTOTPSecret: vi.fn(), parseOTPAuthURI: vi.fn(), displayTOTPCode: vi.fn(), getTimeRemaining: vi.fn() }));
const sync = vi.hoisted(() => ({ createInitialSyncState: vi.fn(), detectConflicts: vi.fn(), resolveAllConflicts: vi.fn(), displaySyncSummary: vi.fn(), updateSyncState: vi.fn(), calculateEntryChecksum: vi.fn() }));
const syncStatus = vi.hoisted(() => ({ getSyncStatus: vi.fn() }));

vi.mock('inquirer', () => ({ default: { prompt } }));
vi.mock('ora', () => ({ default: vi.fn(() => spinner) }));
vi.mock('fs/promises', () => ({ default: fs }));
vi.mock('fs', () => ({ default: fsSync }));
vi.mock('https', () => ({ default: https }));
vi.mock('child_process', () => ({ spawn, exec: vi.fn() }));
vi.mock('clipboardy', () => ({ default: clipboard }));
vi.mock('../src/storage/vault/index.js', () => vault);
vi.mock('../src/storage/drive/index.js', () => drive);
vi.mock('../src/storage/drive/driveClient.js', () => drive);
vi.mock('../src/storage/drive/synchronizer.js', () => syncStatus);
vi.mock('../src/crypto/index.js', () => crypto);
vi.mock('../src/cli/prompts.js', () => prompts);
vi.mock('../src/cli/ensureAuth.js', () => ensure);
vi.mock('../src/cli/duress.js', () => duress);
vi.mock('../src/cli/auditLog.js', () => auditLog);
vi.mock('../src/cli/cloudStorageSetup.js', () => cloudSetup);
vi.mock('../src/cli/googleOAuthSetup.js', () => oauthSetup);
vi.mock('../src/cli/openExternal.js', () => ({ openExternalUrl: vi.fn() }));
vi.mock('../src/cli/progress.js', () => progress);
vi.mock('../src/sync/index.js', () => sync);
vi.mock('../src/cli/passwordStrength.js', () => ({ analyzePasswordStrength: vi.fn(() => ({ feedback: { warning: 'change me' } })), getScoreColor: vi.fn((x: number) => (x ? String(x) : 'gray')), getScoreBar: vi.fn(() => 'bar'), getStrengthSummary: vi.fn(() => ({ score: 1, icon: '!', label: 'Weak' })) }));

import { auditCommand } from '../src/cli/commands/audit.js';
import { authCommand } from '../src/cli/commands/auth.js';
import { deleteCommand } from '../src/cli/commands/delete.js';
import { downloadCommand } from '../src/cli/commands/download.js';
import { editCommand } from '../src/cli/commands/edit.js';
import { favoriteCommand, listFavoritesCommand } from '../src/cli/commands/favorite.js';
import { initCommand } from '../src/cli/commands/init.js';
import { noteAddCommand, noteEditCommand, noteListCommand, noteViewCommand, noteCommand } from '../src/cli/commands/note.js';
import { syncCommand } from '../src/cli/commands/sync.js';
import { totpCommand } from '../src/cli/commands/totp.js';
import { runScheduledUpdateCheckPrompt, updateCommand } from '../src/cli/commands/update.js';
import { uploadCommand } from '../src/cli/commands/upload.js';

const passwordEntry: any = { id: 'e1', title: 'Example', username: 'user', password: 'secret', url: 'https://example.test', notes: 'notes', favorite: false, modified: 1, created: Date.now(), entryType: 'password' };
const fileEntry: any = { id: 'f1', title: 'File', originalName: 'evil?.txt', size: 4, mimeType: 'text/plain', favorite: false, modified: 1, created: 1, entryType: 'file' };
const noteEntry: any = { id: 'n1', title: 'Note', content: 'body\nline', favorite: true, modified: 1, created: 1, entryType: 'note' };

function response(body: unknown, statusCode = 200): any {
  const res: any = { statusCode, headers: {}, on: vi.fn((event: string, cb: (value?: Buffer) => void) => { if (event === 'data') cb(Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))); if (event === 'end') cb(); return res; }), resume: vi.fn(), destroy: vi.fn() };
  return res;
}
function req(): any { return { on: vi.fn(), setTimeout: vi.fn(), end: vi.fn(), destroy: vi.fn() }; }
function tracker(): any { return { setProgress: vi.fn(), finish: vi.fn(), bar: { stop: vi.fn() } }; }

beforeEach(() => {
  vi.resetAllMocks();
  spinner.start.mockImplementation(function () { return spinner; });
  prompt.mockImplementation(async (questions: Array<{ name?: string }> = []) => {
    const names = questions.map((question) => question.name);
    if (names.includes('outputPath')) return { outputPath: '/tmp/file.txt' };
    if (names.includes('overwrite')) return { overwrite: true };
    if (names.includes('fields')) return { fields: [] };
    if (names.includes('input')) return { input: 'SECRET' };
    if (names.includes('inputPath')) return { inputPath: 'browse' };
    if (names.includes('confirm')) return { confirm: true };
    return { title: 'file', notes: '', issuer: '', newContent: 'body', newTitle: 'New', installNow: false, proceedLocal: false };
  });
  vault.vaultExists.mockResolvedValue(true); vault.isUnlocked.mockReturnValue(true); vault.initVault.mockResolvedValue(undefined); vault.unlock.mockResolvedValue(undefined);
  vault.getVaultPaths.mockReturnValue({ dir: '/vault', index: '/vault/index.enc' });
  vault.listEntries.mockResolvedValue([passwordEntry, fileEntry, noteEntry]); vault.searchEntries.mockResolvedValue([passwordEntry]);
  vault.getEntry.mockImplementation(async (id: string) => ({ e1: passwordEntry, f1: fileEntry, n1: noteEntry }[id])); vault.getFileEntry.mockResolvedValue(fileEntry); vault.getNoteEntry.mockResolvedValue(noteEntry);
  vault.getVaultIndex.mockReturnValue({ entries: { e1: { entryType: 'password' }, f1: { entryType: 'file', fileSize: 4, cloudChunks: ['c1'], chunkCount: 1 }, n1: { entryType: 'note' } } });
  vault.addEntry.mockResolvedValue(passwordEntry); vault.addFileEntry.mockResolvedValue(fileEntry); vault.addNoteEntry.mockResolvedValue(noteEntry); vault.updateEntry.mockResolvedValue(passwordEntry); vault.updateNoteEntry.mockResolvedValue(noteEntry); vault.deleteEntry.mockResolvedValue(undefined); vault.toggleFavorite.mockResolvedValue({ favorite: true }); vault.updateVaultIndex.mockResolvedValue(undefined); vault.cleanupTempFiles.mockResolvedValue(undefined);
  drive.isAuthenticated.mockResolvedValue(true); drive.authenticateDrive.mockResolvedValue(undefined); drive.performOAuthFlow.mockResolvedValue(undefined); drive.logout.mockResolvedValue(undefined); drive.isGoogleOAuthConfigured.mockResolvedValue(true); drive.getGoogleOAuthCredentials.mockResolvedValue({ clientId: 'client-id', clientSecret: 'secret' }); drive.getCloudStorageMode.mockResolvedValue('hidden'); drive.setCloudStorageMode.mockResolvedValue(undefined); drive.isCloudStorageModeConfigured.mockResolvedValue(true); drive.getPublicContentFolderName.mockResolvedValue('vault-data'); drive.isPublicContentFolderNameConfigured.mockResolvedValue(true); drive.setPublicContentFolderName.mockResolvedValue(undefined); drive.findAppDataFile.mockResolvedValue('backup-id'); drive.downloadAppDataToBuffer.mockResolvedValue(Buffer.from('backup')); drive.hasAppDataAccess.mockResolvedValue(true); drive.deleteFileFromCloud.mockResolvedValue(undefined); drive.uploadFileToCloud.mockResolvedValue(['c1']); drive.streamDownloadToFile.mockResolvedValue(undefined); drive.isCloudSyncAvailable.mockResolvedValue(true); drive.getParallelismInfo.mockReturnValue({ level: 2, memoryMB: 1024 }); drive.isDriveConnected.mockReturnValue(true); drive.listAppDataFiles.mockResolvedValue([]); drive.deleteFromAppData.mockResolvedValue(undefined); drive.persistCurrentGoogleTokens.mockResolvedValue(undefined);
  crypto.getEntryKey.mockReturnValue(Buffer.alloc(32)); crypto.generatePassword.mockReturnValue('Generated!123'); crypto.generatePassphrase.mockReturnValue('word-word'); crypto.analyzePassword.mockReturnValue({ strength: 'strong', entropy: 80 });
  prompts.promptPassword.mockResolvedValue('password'); prompts.promptPasswordConfirm.mockResolvedValue('password'); prompts.promptConfirm.mockResolvedValue(true); prompts.promptSelectEntry.mockResolvedValue('e1');
  ensure.ensureAuthenticated.mockResolvedValue(true); duress.isInDuressMode.mockReturnValue(false); duress.getDecoyEntries.mockReturnValue([{ id: 'd1', title: 'Decoy', username: 'd', password: 'd', favorite: false }]); auditLog.logAuditEvent.mockResolvedValue(undefined);
  cloudSetup.promptCloudStorageMode.mockResolvedValue('public'); cloudSetup.promptPublicContentFolderName.mockResolvedValue('shared'); oauthSetup.promptGoogleOAuthCredentials.mockResolvedValue({ clientId: 'new-id', clientSecret: 'new-secret' }); oauthSetup.maskGoogleClientId.mockReturnValue('masked');
  progress.createProgressTracker.mockImplementation(() => tracker()); progress.formatBytes.mockImplementation((n: number) => `${n} B`);
  totp.generateTOTPCodeSync.mockReturnValue('123456'); totp.validateTOTPSecret.mockReturnValue(true); totp.cleanTOTPSecret.mockImplementation((s: string) => s.replace(/\s/g, '')); totp.parseOTPAuthURI.mockReturnValue({ secret: 'SECRET', issuer: 'Issuer', algorithm: 'SHA1', digits: 6, period: 30 }); totp.getTimeRemaining.mockReturnValue(20);
  sync.createInitialSyncState.mockReturnValue({ entryVersions: {}, conflictHistory: [], lastFullSync: undefined }); sync.detectConflicts.mockReturnValue([]); sync.resolveAllConflicts.mockResolvedValue([]); sync.calculateEntryChecksum.mockReturnValue('checksum'); syncStatus.getSyncStatus.mockReturnValue({ connected: true, pendingUploads: 0, lastSync: undefined });
  fs.stat.mockRejectedValue(new Error('missing')); fs.readFile.mockRejectedValue(new Error('missing')); fs.writeFile.mockResolvedValue(undefined); fs.mkdir.mockResolvedValue(undefined); fs.rm.mockResolvedValue(undefined); fs.unlink.mockResolvedValue(undefined);
  https.request.mockReset(); https.get.mockReset();
  const stream: any = { on: vi.fn((event: string, cb: (err?: Error) => void) => { if (event === 'finish') cb(); return stream; }), close: vi.fn((cb: (err?: Error) => void) => cb()), destroy: vi.fn(), pipe: vi.fn() }; fsSync.createWriteStream.mockReturnValue(stream);
  clipboard.write.mockResolvedValue(undefined); clipboard.read.mockResolvedValue('123456');
});

afterEach(() => { delete process.env.BLANKDRIVE_OAUTH_BACKEND_URL; vi.useRealTimers(); });

describe('remaining CLI command error, cancellation, and empty branches', () => {
  it('audits duress/all, empty data, unlock failure, and every age category', async () => {
    duress.isInDuressMode.mockReturnValueOnce(true); prompt.mockResolvedValueOnce({}); await auditCommand({ all: true });
    vault.vaultExists.mockResolvedValueOnce(false); await auditCommand();
    vault.isUnlocked.mockReturnValueOnce(false); vault.unlock.mockRejectedValueOnce(new Error('bad unlock')); await auditCommand();
    vault.listEntries.mockResolvedValueOnce([{ id: 'f', entryType: 'file' }]); await auditCommand();
    vault.listEntries.mockResolvedValueOnce([{ id: 'e', entryType: 'password' }]); vault.getEntry.mockResolvedValueOnce(null); await auditCommand();
    const day = 86400000;
    const entries = [{ id: 'expired', entryType: 'password' }, { id: 'warning', entryType: 'password' }, { id: 'good', entryType: 'password' }, { id: 'unknown', entryType: 'password' }];
    vault.listEntries.mockResolvedValueOnce(entries); vault.getEntry.mockImplementation(async (id: string) => ({ expired: { ...passwordEntry, id, passwordLastChanged: Date.now() - 100 * day }, warning: { ...passwordEntry, id, passwordLastChanged: Date.now() - 70 * day }, good: { ...passwordEntry, id, passwordLastChanged: Date.now() - day }, unknown: { ...passwordEntry, id, password: undefined, passwordLastChanged: undefined, created: undefined } }[id]));
    await auditCommand({ all: true });
    expect(vault.listEntries).toHaveBeenCalled();
  });

  it('handles auth logout/unlock failures, setup modes, reauth cancellation, and OAuth recovery', async () => {
    drive.logout.mockRejectedValueOnce(new Error('logout failed')); await authCommand({ logout: true });
    vault.vaultExists.mockResolvedValueOnce(false); await authCommand();
    vault.isUnlocked.mockReturnValueOnce(false); vault.unlock.mockRejectedValueOnce(new Error('unlock failed')); await authCommand();
    drive.isCloudStorageModeConfigured.mockResolvedValueOnce(false); drive.getCloudStorageMode.mockResolvedValueOnce('public'); drive.isPublicContentFolderNameConfigured.mockResolvedValueOnce(false); await authCommand();
    await authCommand({ setup: true });
    prompts.promptConfirm.mockResolvedValueOnce(false); await authCommand();
    drive.isAuthenticated.mockResolvedValueOnce(false); drive.performOAuthFlow.mockRejectedValueOnce(new Error('redirect_uri_mismatch')); await authCommand();
    drive.isAuthenticated.mockResolvedValueOnce(false); drive.performOAuthFlow.mockRejectedValueOnce(new Error('invalid_client')).mockRejectedValueOnce(new Error('retry failed')); await authCommand();
    drive.isAuthenticated.mockResolvedValueOnce(false); drive.performOAuthFlow.mockRejectedValueOnce(new Error('invalid_client')); oauthSetup.promptGoogleOAuthCredentials.mockRejectedValueOnce(new Error('setup cancelled')); await authCommand();
    process.env.BLANKDRIVE_OAUTH_BACKEND_URL = 'http://backend'; drive.isAuthenticated.mockResolvedValueOnce(false); await authCommand();
    expect(drive.performOAuthFlow).toHaveBeenCalled();
  });

  it('covers delete duress/empty/invalid/multiple cancellation and cloud/local failures', async () => {
    duress.isInDuressMode.mockReturnValueOnce(true); await deleteCommand(); duress.getDecoyEntries.mockReturnValueOnce([]); await deleteCommand('none');
    duress.getDecoyEntries.mockReturnValueOnce([{ title: 'Decoy' }]); prompts.promptConfirm.mockResolvedValueOnce(false); await deleteCommand('Decoy');
    ensure.ensureAuthenticated.mockResolvedValueOnce(false); await deleteCommand('x');
    await deleteCommand(''); await deleteCommand('9');
    vault.searchEntries.mockResolvedValueOnce([passwordEntry, { ...passwordEntry, id: 'e2', title: 'Example 2' }]); prompts.promptSelectEntry.mockResolvedValueOnce(null); await deleteCommand('Example');
    vault.searchEntries.mockResolvedValueOnce([fileEntry]); drive.deleteFileFromCloud.mockRejectedValueOnce(new Error('cloud down')); prompt.mockResolvedValueOnce({ proceedLocal: false }); await deleteCommand('File', { force: true });
    vault.searchEntries.mockResolvedValueOnce([passwordEntry]); vault.deleteEntry.mockRejectedValueOnce(new Error('disk full')); await deleteCommand('Example', { force: true });
    expect(spinner.fail).toHaveBeenCalled();
  });

  it('keeps the CLI focused on web and vault workflows', async () => {
    await expect(import('../src/cli/commands/desktop.js')).rejects.toThrow();
    expect(drive.isCloudSyncAvailable).toBeDefined();
  });

  it('covers download empty, invalid, browse cancellation, unavailable cloud, and stream errors', async () => {
    ensure.ensureAuthenticated.mockResolvedValueOnce(false); await downloadCommand('File');
    vault.getVaultIndex.mockReturnValueOnce(null); await downloadCommand();
    vault.listEntries.mockResolvedValueOnce([]); await downloadCommand();
    await downloadCommand('9'); await downloadCommand('missing');
    vault.getFileEntry.mockResolvedValueOnce(null); await downloadCommand('File');
    prompt.mockResolvedValueOnce({ outputPath: 'browse' }); await downloadCommand('File');
    vault.getVaultIndex.mockReturnValueOnce({ entries: { f1: { entryType: 'file', cloudChunks: [] } } }); prompt.mockResolvedValueOnce({ outputPath: '/tmp/file.txt' }); await downloadCommand('File');
    drive.isCloudSyncAvailable.mockResolvedValueOnce(false); vault.getVaultIndex.mockReturnValueOnce({ entries: { f1: { entryType: 'file', cloudChunks: ['c1'] } } }); prompt.mockResolvedValueOnce({ outputPath: '/tmp/file.txt' }); await downloadCommand('File');
    drive.streamDownloadToFile.mockRejectedValueOnce(new Error('download failed')); prompt.mockResolvedValueOnce({ outputPath: '/tmp/file.txt' }); await downloadCommand('File');
    expect(progress.createProgressTracker).toHaveBeenCalled();
  });

  it('covers edit duress/empty/list-only/cancellation/no-change/update failures', async () => {
    duress.isInDuressMode.mockReturnValueOnce(true); duress.getDecoyEntries.mockReturnValueOnce([]); await editCommand('none');
    duress.isInDuressMode.mockReturnValueOnce(true); prompt.mockResolvedValueOnce({ fields: [] }); await editCommand();
    vault.vaultExists.mockResolvedValueOnce(false); await editCommand();
    vault.isUnlocked.mockReturnValueOnce(false); vault.unlock.mockRejectedValueOnce(new Error('bad unlock')); await editCommand('Example');
    vault.listEntries.mockResolvedValueOnce([]); await editCommand();
    vault.listEntries.mockResolvedValueOnce([{ id: 'file_only', title: 'File', entryType: 'file' }]); await editCommand();
    prompts.promptSelectEntry.mockResolvedValueOnce('e1'); vault.getEntry.mockResolvedValueOnce(null); await editCommand();
    prompts.promptSelectEntry.mockResolvedValueOnce('e1'); prompt.mockResolvedValueOnce({ fields: [] }); await editCommand();
    prompts.promptSelectEntry.mockResolvedValueOnce('e1'); prompt.mockResolvedValueOnce({ fields: ['username'] }).mockResolvedValueOnce({ username: 'user' }); await editCommand();
    prompts.promptSelectEntry.mockResolvedValueOnce('e1'); prompt.mockResolvedValueOnce({ fields: ['password'] }).mockResolvedValueOnce({ action: 'remove' }).mockResolvedValueOnce({ confirm: false }); await editCommand();
    prompts.promptSelectEntry.mockResolvedValueOnce('e1'); prompt.mockResolvedValueOnce({ fields: ['password'] }).mockResolvedValueOnce({ action: 'keep' }); await editCommand();
    prompts.promptSelectEntry.mockResolvedValueOnce('e1'); prompt.mockResolvedValueOnce({ fields: ['title'] }).mockResolvedValueOnce({ title: 'Changed' }).mockResolvedValueOnce({ confirm: true }); vault.updateEntry.mockResolvedValueOnce(null); await editCommand();
    prompts.promptSelectEntry.mockResolvedValueOnce('e1'); prompt.mockResolvedValueOnce({ fields: ['title'] }).mockResolvedValueOnce({ title: 'Changed' }).mockResolvedValueOnce({ confirm: true }); vault.updateEntry.mockRejectedValueOnce(new Error('save failed')); await editCommand();
    expect(spinner.fail).toHaveBeenCalled();
  });

  it('covers favorite empty, missing, cancellation, null result, and failures', async () => {
    duress.isInDuressMode.mockReturnValueOnce(true); duress.getDecoyEntries.mockReturnValueOnce([]); await favoriteCommand('none');
    vault.vaultExists.mockResolvedValueOnce(false); await favoriteCommand();
    vault.isUnlocked.mockReturnValueOnce(false); vault.unlock.mockRejectedValueOnce(new Error('unlock')); await favoriteCommand();
    vault.listEntries.mockResolvedValueOnce([]); await favoriteCommand();
    vault.listEntries.mockResolvedValueOnce([passwordEntry]); await favoriteCommand('none');
    vault.listEntries.mockResolvedValueOnce([passwordEntry, noteEntry]); prompts.promptSelectEntry.mockResolvedValueOnce(null); await favoriteCommand();
    vault.toggleFavorite.mockResolvedValueOnce(null); prompts.promptSelectEntry.mockResolvedValueOnce('e1'); await favoriteCommand();
    vault.toggleFavorite.mockRejectedValueOnce(new Error('toggle failed')); prompts.promptSelectEntry.mockResolvedValueOnce('e1'); await favoriteCommand();
    vault.vaultExists.mockResolvedValueOnce(false); await listFavoritesCommand();
    vault.isUnlocked.mockReturnValueOnce(false); vault.unlock.mockRejectedValueOnce(new Error('unlock')); await listFavoritesCommand();
    vault.listEntries.mockResolvedValueOnce([]); await listFavoritesCommand();
    vault.listEntries.mockRejectedValueOnce(new Error('load')); await listFavoritesCommand();
    expect(spinner.fail).toHaveBeenCalled();
  });

  it('covers init create/storage errors and restore early/error branches', async () => {
    vault.vaultExists.mockResolvedValueOnce(false); prompts.promptPasswordConfirm.mockRejectedValueOnce(new Error('cancel')); await initCommand({});
    vault.vaultExists.mockResolvedValueOnce(false); vault.initVault.mockRejectedValueOnce(new Error('create failed')); await initCommand({});
    vault.vaultExists.mockResolvedValueOnce(false); drive.isCloudStorageModeConfigured.mockResolvedValueOnce(false); drive.setCloudStorageMode.mockRejectedValueOnce(new Error('mode failed')); await initCommand({});
    vault.vaultExists.mockResolvedValueOnce(true); await initCommand({ restore: true });
    vault.vaultExists.mockResolvedValueOnce(false); drive.isCloudStorageModeConfigured.mockResolvedValueOnce(false); drive.setCloudStorageMode.mockResolvedValueOnce('public'); await initCommand({ restore: true });
    vault.vaultExists.mockResolvedValueOnce(false); drive.authenticateDrive.mockRejectedValueOnce(new Error('auth')); drive.isGoogleOAuthConfigured.mockResolvedValueOnce(false); drive.performOAuthFlow.mockRejectedValueOnce(new Error('oauth')); await initCommand({ restore: true });
    vault.vaultExists.mockResolvedValueOnce(false); drive.hasAppDataAccess.mockResolvedValueOnce(false); await initCommand({ restore: true });
    vault.vaultExists.mockResolvedValueOnce(false); drive.findAppDataFile.mockResolvedValueOnce(null); await initCommand({ restore: true });
    vault.vaultExists.mockResolvedValueOnce(false); drive.downloadAppDataToBuffer.mockRejectedValueOnce(new Error('download')); await initCommand({ restore: true });
    vault.vaultExists.mockResolvedValueOnce(false); fs.writeFile.mockRejectedValueOnce(new Error('write')); await initCommand({ restore: true });
    expect(vault.initVault).toHaveBeenCalled();
  });

  it('covers note add/view/edit/list empty, cancellation, null, errors, and aliases', async () => {
    duress.isInDuressMode.mockReturnValueOnce(true); prompt.mockResolvedValueOnce({ title: 'D' }).mockResolvedValueOnce({ content: 'x' }); await noteAddCommand();
    vault.vaultExists.mockResolvedValueOnce(false); await noteAddCommand();
    vault.isUnlocked.mockReturnValueOnce(false); vault.unlock.mockRejectedValueOnce(new Error('unlock')); await noteAddCommand();
    vault.addNoteEntry.mockRejectedValueOnce(new Error('save')); prompt.mockResolvedValueOnce({ title: 'N' }).mockResolvedValueOnce({ content: 'x' }); await noteAddCommand();
    vault.vaultExists.mockResolvedValueOnce(false); await noteViewCommand();
    vault.listEntries.mockResolvedValueOnce([]); await noteViewCommand();
    vault.listEntries.mockResolvedValueOnce([noteEntry]); await noteViewCommand('missing');
    vault.listEntries.mockResolvedValueOnce([noteEntry]); prompts.promptSelectEntry.mockResolvedValueOnce(null); await noteViewCommand();
    vault.getNoteEntry.mockResolvedValueOnce(null); await noteViewCommand('Note');
    vault.vaultExists.mockResolvedValueOnce(false); await noteEditCommand();
    vault.listEntries.mockResolvedValueOnce([]); await noteEditCommand();
    vault.listEntries.mockResolvedValueOnce([noteEntry]); await noteEditCommand('missing');
    vault.listEntries.mockResolvedValueOnce([noteEntry]); vault.getNoteEntry.mockResolvedValueOnce(null); await noteEditCommand('Note');
    vault.listEntries.mockResolvedValueOnce([noteEntry]); prompt.mockResolvedValueOnce({ editChoice: 'both' }).mockResolvedValueOnce({ newTitle: 'New' }).mockResolvedValueOnce({ newContent: 'body' }); vault.updateNoteEntry.mockResolvedValueOnce(null); await noteEditCommand('Note');
    vault.listEntries.mockResolvedValueOnce([noteEntry]); prompt.mockResolvedValueOnce({ editChoice: 'content' }).mockResolvedValueOnce({ newContent: 'body' }); vault.updateNoteEntry.mockRejectedValueOnce(new Error('update')); await noteEditCommand('Note');
    vault.listEntries.mockResolvedValueOnce([]); await noteListCommand(); vault.listEntries.mockRejectedValueOnce(new Error('list')); await noteListCommand();
    await noteCommand('new'); await noteCommand('show', 'Note'); await noteCommand('ls'); await noteCommand('unknown');
    expect(vault.addNoteEntry).toHaveBeenCalled();
  });

  it('covers sync auth/status/conflicts/empty and resolution failures', async () => {
    ensure.ensureAuthenticated.mockResolvedValueOnce(false); await syncCommand();
    syncStatus.getSyncStatus.mockReturnValueOnce({ connected: false, pendingUploads: 2, lastSync: Date.now() - 3600000 }); fs.readFile.mockResolvedValueOnce(JSON.stringify({ entryVersions: { e1: {} }, conflictHistory: [{ strategy: 'skip', conflict: { entryTitle: 'Example', type: 'both_modified', localModified: 1, remoteModified: 2 } }] })); await syncCommand({ status: true });
    fs.readFile.mockResolvedValueOnce(JSON.stringify({ entryVersions: {}, conflictHistory: [] })); await syncCommand({ conflicts: true });
    drive.isDriveConnected.mockReturnValueOnce(false); await syncCommand({ force: true });
    vault.listEntries.mockRejectedValueOnce(new Error('list')); await syncCommand();
    sync.detectConflicts.mockReturnValueOnce([{ id: 'e1', entryTitle: 'Example', type: 'both_modified', localVersion: 1, remoteVersion: 2, localModified: 1 }]); sync.resolveAllConflicts.mockResolvedValueOnce([
      { strategy: 'keep_local', conflict: { id: 'e1', entryTitle: 'Example', localVersion: 1, remoteVersion: 2 }, resolvedEntry: passwordEntry },
      { strategy: 'keep_newest', conflict: { id: 'e1', entryTitle: 'Example', localVersion: 1, remoteVersion: 2 }, resolvedEntry: passwordEntry },
      { strategy: 'keep_remote', conflict: { id: 'e1', entryTitle: 'Example', localVersion: 1, remoteVersion: 2 }, resolvedEntry: passwordEntry },
      { strategy: 'keep_both', conflict: { id: 'e1', entryTitle: 'Example', localVersion: 1, remoteVersion: 2 }, resolvedEntry: passwordEntry },
      { strategy: 'merge', conflict: { id: 'e1', entryTitle: 'Example', localVersion: 1, remoteVersion: 2 }, resolvedEntry: passwordEntry },
      { strategy: 'delete', conflict: { id: 'e1', entryTitle: 'Example', localVersion: 1, remoteVersion: 2 } },
      { strategy: 'skip', conflict: { id: 'e1', entryTitle: 'Example', localVersion: 1, remoteVersion: 2 } },
    ]); vault.updateEntry.mockRejectedValueOnce(new Error('resolution failed')); await syncCommand();
    expect(sync.displaySyncSummary).toHaveBeenCalled();
  });

  it('covers TOTP aliases, missing entries, invalid URI, generation/clipboard/remove/list failures', async () => {
    duress.isInDuressMode.mockReturnValueOnce(true); await totpCommand('ls'); await totpCommand('setup'); await totpCommand('show'); await totpCommand('rm'); await totpCommand();
    ensure.ensureAuthenticated.mockResolvedValueOnce(false); await totpCommand('list');
    vault.listEntries.mockResolvedValueOnce([]); await totpCommand('list');
    vault.listEntries.mockResolvedValueOnce([passwordEntry]); await totpCommand('view', 'missing');
    vault.getEntry.mockResolvedValueOnce({ ...passwordEntry }); await totpCommand('view', 'Example');
    vault.getEntry.mockResolvedValueOnce({ ...passwordEntry, totp: { secret: 'S' } }); totp.generateTOTPCodeSync.mockImplementationOnce(() => { throw new Error('bad code'); }); await totpCommand('view', 'Example');
    vault.getEntry.mockResolvedValueOnce({ ...passwordEntry, totp: { secret: 'S' } }); clipboard.write.mockRejectedValueOnce(new Error('clipboard')); await totpCommand('view', 'Example', { copy: true });
    vault.getEntry.mockResolvedValueOnce(passwordEntry); totp.parseOTPAuthURI.mockReturnValueOnce(null); prompt.mockResolvedValueOnce({ input: 'otpauth://bad' }); await totpCommand('add', 'Example');
    vault.getEntry.mockResolvedValueOnce(passwordEntry); prompt.mockResolvedValueOnce({ input: 'SECRET' }).mockResolvedValueOnce({ issuer: '' }).mockResolvedValueOnce({ confirm: false }); await totpCommand('add', 'Example');
    vault.getEntry.mockResolvedValueOnce({ ...passwordEntry, totp: { secret: 'S' } }); prompt.mockResolvedValueOnce({ confirm: false }); await totpCommand('remove', 'Example');
    vault.getEntry.mockResolvedValueOnce({ ...passwordEntry, totp: { secret: 'S' } }); vault.updateEntry.mockRejectedValueOnce(new Error('remove failed')); prompt.mockResolvedValueOnce({ confirm: true }); await expect(totpCommand('remove', 'Example')).rejects.toThrow('remove failed');
    vault.listEntries.mockRejectedValueOnce(new Error('list')); await totpCommand('list');
    expect(spinner.fail).toHaveBeenCalled();
  });

  it('covers update scheduled/no-update/json install outcomes and npm failures', async () => {
    fs.readFile.mockResolvedValueOnce(JSON.stringify({ lastCheckedAt: new Date().toISOString() })); await updateCommand({ scheduled: true, currentVersion: '1.0.0' });
    https.request.mockImplementationOnce((_o: unknown, cb: any) => { cb(response({ version: '1.0.0' })); return req(); }); await updateCommand({ json: true, currentVersion: '1.0.0' });
    https.request.mockImplementationOnce((_o: unknown, cb: any) => { cb(response({ version: '2.0.0' })); return req(); }); spawn.mockReturnValueOnce({ once: vi.fn((event: string, cb: (code?: number) => void) => event === 'close' && cb(1)), unref: vi.fn() }); await updateCommand({ json: true, install: true, currentVersion: '1.0.0' });
    https.request.mockImplementationOnce((_o: unknown, cb: any) => { cb(response({ version: '2.0.0' })); return req(); }); https.request.mockImplementationOnce(() => { const r = req(); r.on.mockImplementation((event: string, cb: (e: Error) => void) => { if (event === 'error') cb(new Error('network')); return r; }); return r; }); await updateCommand({ json: true, currentVersion: '1.0.0' });
    https.request.mockImplementationOnce((_o: unknown, cb: any) => { cb(response({ version: '2.0.0' })); return req(); }); prompt.mockResolvedValueOnce({ installNow: false }); await updateCommand({ currentVersion: '1.0.0' });
    const oldIn = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY'); const oldOut = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY'); Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: false }); Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: false }); https.request.mockImplementationOnce((_o: unknown, cb: any) => { cb(response({ version: '2.0.0' })); return req(); }); await runScheduledUpdateCheckPrompt(); if (oldIn) Object.defineProperty(process.stdin, 'isTTY', oldIn); if (oldOut) Object.defineProperty(process.stdout, 'isTTY', oldOut);
    expect(fs.writeFile).toHaveBeenCalled();
  });

  it('covers upload duress/auth/browse/storage/file/encryption/cloud failures', async () => {
    duress.isInDuressMode.mockReturnValueOnce(true); fs.stat.mockRejectedValueOnce(new Error('missing')); await uploadCommand('/missing');
    ensure.ensureAuthenticated.mockResolvedValueOnce(false); await uploadCommand('/tmp/file');
    prompt.mockResolvedValueOnce({ switchToPublic: false }).mockResolvedValueOnce({ inputPath: 'browse' }); await uploadCommand();
    fs.stat.mockResolvedValueOnce({ isFile: () => false, size: 10 }); await uploadCommand('/tmp/dir');
    fs.stat.mockResolvedValue({ isFile: () => true, size: 4 }); prompt.mockResolvedValueOnce({ title: 'file', notes: '' }); vault.addFileEntry.mockRejectedValueOnce(new Error('encrypt')); await uploadCommand('/tmp/file');
    vault.addFileEntry.mockResolvedValueOnce({ ...fileEntry }); drive.uploadFileToCloud.mockRejectedValueOnce(new Error('cloud')); prompt.mockResolvedValueOnce({ title: 'file', notes: '' }); await uploadCommand('/tmp/file');
    drive.getCloudStorageMode.mockResolvedValueOnce('public'); drive.isPublicContentFolderNameConfigured.mockResolvedValueOnce(false); prompt.mockResolvedValueOnce({ title: 'file', notes: '' }); await uploadCommand('/tmp/file');
    expect(vault.addFileEntry).toHaveBeenCalled();
  });
});
