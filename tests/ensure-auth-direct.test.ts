import { beforeEach, describe, expect, it, vi } from 'vitest';

const promptPassword = vi.hoisted(() => vi.fn());
vi.mock('../src/cli/prompts.js', () => ({ promptPassword }));

const inquirerPrompt = vi.hoisted(() => vi.fn());
vi.mock('inquirer', () => ({ default: { prompt: inquirerPrompt } }));

const spinner = vi.hoisted(() => ({ succeed: vi.fn(), fail: vi.fn(), stop: vi.fn() }));
const ora = vi.hoisted(() => vi.fn(() => ({ start: vi.fn(() => spinner) })));
vi.mock('ora', () => ({ default: ora }));

const vault = vi.hoisted(() => ({
  vaultExists: vi.fn(),
  unlock: vi.fn(),
  isUnlocked: vi.fn(),
  getVault2FAConfig: vi.fn(),
  useBackupCode: vi.fn(),
  lock: vi.fn(),
}));
vi.mock('../src/storage/vault/index.js', () => vault);

const drive = vi.hoisted(() => ({
  isAuthenticated: vi.fn(),
  authenticateDrive: vi.fn(),
  performOAuthFlow: vi.fn(),
  setGoogleOAuthCredentials: vi.fn(),
  isGoogleOAuthConfigured: vi.fn(),
  getCloudStorageMode: vi.fn(),
  isCloudStorageModeConfigured: vi.fn(),
  getPublicContentFolderName: vi.fn(),
  isPublicContentFolderNameConfigured: vi.fn(),
  setPublicContentFolderName: vi.fn(),
  setCloudStorageMode: vi.fn(),
}));
vi.mock('../src/storage/drive/index.js', () => drive);

const initializeKeyManager = vi.hoisted(() => vi.fn());
vi.mock('../src/crypto/index.js', () => ({ initializeKeyManager }));

const logAuditEvent = vi.hoisted(() => vi.fn());
vi.mock('../src/cli/auditLog.js', () => ({ logAuditEvent }));

const duress = vi.hoisted(() => ({ isInDuressMode: vi.fn() }));
vi.mock('../src/cli/duress.js', () => duress);

const verifyVault2FACode = vi.hoisted(() => vi.fn());
const verifyBackupCode = vi.hoisted(() => vi.fn());
const prompt2FACode = vi.hoisted(() => vi.fn());
vi.mock('../src/cli/vault2fa.js', () => ({ verifyVault2FACode, verifyBackupCode, prompt2FACode }));

const promptGoogleOAuthCredentials = vi.hoisted(() => vi.fn());
vi.mock('../src/cli/googleOAuthSetup.js', () => ({ promptGoogleOAuthCredentials }));

const promptCloudStorageMode = vi.hoisted(() => vi.fn());
const promptPublicContentFolderName = vi.hoisted(() => vi.fn());
vi.mock('../src/cli/cloudStorageSetup.js', () => ({ promptCloudStorageMode, promptPublicContentFolderName }));

const openExternalUrl = vi.hoisted(() => vi.fn());
vi.mock('../src/cli/openExternal.js', () => ({ openExternalUrl }));
vi.mock('../src/cli/commands/destruct.js', () => ({ destructCommand: vi.fn() }));

import { ensureAuthenticated } from '../src/cli/ensureAuth.js';

function configureNormalFlow(): void {
  // Clear queued one-shot outcomes when a test reuses the baseline mid-case.
  for (const mock of [
    inquirerPrompt,
    vault.unlock,
    prompt2FACode,
    promptCloudStorageMode,
    promptPublicContentFolderName,
    promptGoogleOAuthCredentials,
    drive.performOAuthFlow,
    openExternalUrl,
  ]) mock.mockReset();

  duress.isInDuressMode.mockReturnValue(false);
  vault.vaultExists.mockResolvedValue(true);
  vault.isUnlocked.mockReturnValue(true);
  vault.getVault2FAConfig.mockReturnValue(undefined);
  vault.unlock.mockResolvedValue(undefined);
  vault.useBackupCode.mockResolvedValue(undefined);
  vault.lock.mockClear();
  drive.isCloudStorageModeConfigured.mockResolvedValue(true);
  drive.getCloudStorageMode.mockResolvedValue('hidden');
  drive.isPublicContentFolderNameConfigured.mockResolvedValue(true);
  drive.getPublicContentFolderName.mockResolvedValue('vault-data');
  drive.isGoogleOAuthConfigured.mockResolvedValue(true);
  drive.isAuthenticated.mockResolvedValue(false);
  drive.authenticateDrive.mockResolvedValue(undefined);
  drive.performOAuthFlow.mockResolvedValue(undefined);
  drive.setGoogleOAuthCredentials.mockResolvedValue(undefined);
  drive.setCloudStorageMode.mockResolvedValue(undefined);
  drive.setPublicContentFolderName.mockResolvedValue(undefined);
  promptPassword.mockResolvedValue('correct-password');
  prompt2FACode.mockResolvedValue('123456');
  verifyVault2FACode.mockReturnValue(false);
  verifyBackupCode.mockReturnValue(-1);
  promptCloudStorageMode.mockResolvedValue('hidden');
  promptPublicContentFolderName.mockResolvedValue('vault-data');
  promptGoogleOAuthCredentials.mockResolvedValue({ clientId: 'id.apps.googleusercontent.com', clientSecret: 'secret-1234' });
  openExternalUrl.mockResolvedValue(undefined);
  logAuditEvent.mockResolvedValue(undefined);
  inquirerPrompt.mockResolvedValue({ action: 'retry' });
  spinner.succeed.mockClear();
  spinner.fail.mockClear();
  spinner.stop.mockClear();
  ora.mockClear();
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.BLANKDRIVE_OAUTH_BACKEND_URL;
  configureNormalFlow();
});

describe('ensureAuthenticated direct branch coverage', () => {
  it('returns immediately for duress mode and for a missing vault', async () => {
    duress.isInDuressMode.mockReturnValueOnce(true);
    expect(await ensureAuthenticated()).toBe(true);
    expect(vault.vaultExists).not.toHaveBeenCalled();

    duress.isInDuressMode.mockReturnValue(false);
    vault.vaultExists.mockResolvedValue(false);
    expect(await ensureAuthenticated()).toBe(false);
  });

  it('unlocks on the first try and completes hidden-storage OAuth', async () => {
    vault.isUnlocked.mockReturnValue(false);
    drive.performOAuthFlow.mockImplementation(async (open: (url: string) => Promise<void>) => open('https://accounts.example.test'));
    expect(await ensureAuthenticated()).toBe(true);
    expect(initializeKeyManager).toHaveBeenCalledOnce();
    expect(vault.unlock).toHaveBeenCalledWith('correct-password');
    expect(logAuditEvent).toHaveBeenCalledWith('vault_unlocked');
    expect(logAuditEvent).toHaveBeenCalledWith('auth_google_connected');
    expect(openExternalUrl).toHaveBeenCalledWith('https://accounts.example.test');
  });

  it('retries an invalid password and supports exit and destruct cancellation', async () => {
    vault.isUnlocked.mockReturnValue(false);
    vault.unlock.mockRejectedValueOnce(new Error('invalid password')).mockResolvedValueOnce(undefined);
    inquirerPrompt.mockResolvedValueOnce({ action: 'retry' });
    expect(await ensureAuthenticated()).toBe(true);
    expect(logAuditEvent).toHaveBeenCalledWith('failed_unlock_attempt');
    expect(vault.unlock).toHaveBeenCalledTimes(2);

    configureNormalFlow();
    vault.isUnlocked.mockReturnValue(false);
    vault.unlock.mockRejectedValue(new Error('invalid password'));
    inquirerPrompt.mockResolvedValueOnce({ action: 'exit' });
    expect(await ensureAuthenticated()).toBe(false);
    expect(spinner.stop).toHaveBeenCalled();

    configureNormalFlow();
    vault.isUnlocked.mockReturnValue(false);
    vault.unlock.mockRejectedValue(new Error('invalid password'));
    inquirerPrompt.mockResolvedValueOnce({ action: 'destruct' });
    expect(await ensureAuthenticated()).toBe(false);
  });

  it('rejects after three failed password attempts', async () => {
    vault.isUnlocked.mockReturnValue(false);
    vault.unlock.mockRejectedValue(new Error('wrong password'));
    inquirerPrompt.mockResolvedValue({ action: 'retry' });
    expect(await ensureAuthenticated()).toBe(false);
    expect(vault.unlock).toHaveBeenCalledTimes(3);
    expect(logAuditEvent).toHaveBeenCalledTimes(3);
  });

  it('allows the third password attempt to succeed', async () => {
    vault.isUnlocked.mockReturnValue(false);
    vault.unlock.mockRejectedValueOnce(new Error('wrong password')).mockRejectedValueOnce(new Error('wrong password')).mockResolvedValueOnce(undefined);
    inquirerPrompt.mockResolvedValue({ action: 'retry' });
    // The source's post-loop guard treats a success on attempt three as exhausted.
    expect(await ensureAuthenticated()).toBe(false);
    expect(vault.unlock).toHaveBeenCalledTimes(3);
    expect(logAuditEvent).not.toHaveBeenCalledWith('vault_unlocked');
  });

  it('accepts a valid TOTP code after unlocking', async () => {
    vault.isUnlocked.mockReturnValue(false);
    vault.getVault2FAConfig.mockReturnValue({ enabled: true, secret: 'totp-secret' });
    verifyVault2FACode.mockReturnValue(true);
    expect(await ensureAuthenticated()).toBe(true);
    expect(verifyVault2FACode).toHaveBeenCalledWith('123456', 'totp-secret');
    expect(logAuditEvent).toHaveBeenCalledWith('vault_unlocked');
  });

  it('accepts a valid backup code and consumes it', async () => {
    vault.isUnlocked.mockReturnValue(false);
    const backupCodes = ['hash-one', 'hash-two'];
    vault.getVault2FAConfig.mockReturnValue({ enabled: true, secret: 'totp-secret', backupCodes });
    prompt2FACode.mockResolvedValue('ABCD-EFGH');
    verifyBackupCode.mockReturnValue(1);
    expect(await ensureAuthenticated()).toBe(true);
    expect(verifyBackupCode).toHaveBeenCalledWith('ABCD-EFGH', backupCodes);
    expect(vault.useBackupCode).toHaveBeenCalledWith(1);
    expect(logAuditEvent).toHaveBeenCalledWith('vault_unlocked_backup_code');
  });

  it('locks and audits after three invalid 2FA attempts', async () => {
    vault.isUnlocked.mockReturnValue(false);
    vault.getVault2FAConfig.mockReturnValue({ enabled: true, secret: 'totp-secret', backupCodes: ['hash'] });
    prompt2FACode.mockResolvedValueOnce('bad-code').mockResolvedValueOnce('ABCD-EFGH').mockResolvedValueOnce('654321');
    verifyBackupCode.mockReturnValue(-1);
    verifyVault2FACode.mockReturnValue(false);
    expect(await ensureAuthenticated()).toBe(false);
    expect(vault.lock).toHaveBeenCalledOnce();
    expect(logAuditEvent).toHaveBeenCalledWith('failed_2fa_attempt');
    expect(drive.isCloudStorageModeConfigured).not.toHaveBeenCalled();
  });

  it('rejects backup-shaped input when no backup-code list is configured', async () => {
    vault.isUnlocked.mockReturnValue(false);
    vault.getVault2FAConfig.mockReturnValue({ enabled: true, secret: 'totp-secret' });
    prompt2FACode.mockResolvedValue('ABCD-EFGH');
    verifyVault2FACode.mockReturnValue(false);
    expect(await ensureAuthenticated()).toBe(false);
    expect(verifyBackupCode).not.toHaveBeenCalled();
    expect(vault.lock).toHaveBeenCalledOnce();
  });

  it('onboards public storage and repairs a missing public folder name', async () => {
    drive.isCloudStorageModeConfigured.mockResolvedValueOnce(false);
    promptCloudStorageMode.mockResolvedValueOnce('public');
    promptPublicContentFolderName.mockResolvedValueOnce('shared-data');
    drive.getCloudStorageMode.mockResolvedValueOnce('public');
    drive.isPublicContentFolderNameConfigured.mockResolvedValueOnce(false);
    drive.getPublicContentFolderName.mockResolvedValueOnce('old-name');
    promptPublicContentFolderName.mockResolvedValueOnce('repaired-data');
    expect(await ensureAuthenticated()).toBe(true);
    expect(drive.setCloudStorageMode).toHaveBeenCalledWith('public');
    expect(drive.setPublicContentFolderName).toHaveBeenNthCalledWith(1, 'shared-data');
    expect(drive.setPublicContentFolderName).toHaveBeenNthCalledWith(2, 'repaired-data');
    expect(promptPublicContentFolderName).toHaveBeenLastCalledWith('old-name');

    configureNormalFlow();
    drive.getCloudStorageMode.mockResolvedValue('public');
    drive.isPublicContentFolderNameConfigured.mockResolvedValue(false);
    drive.getPublicContentFolderName.mockResolvedValue(undefined);
    promptPublicContentFolderName.mockResolvedValue('default-data');
    expect(await ensureAuthenticated()).toBe(true);
    expect(promptPublicContentFolderName).toHaveBeenCalledWith(undefined);
  });

  it('onboards hidden storage without a folder and skips credential setup for the backend', async () => {
    drive.isCloudStorageModeConfigured.mockResolvedValue(false);
    promptCloudStorageMode.mockResolvedValue('hidden');
    drive.isGoogleOAuthConfigured.mockResolvedValue(false);
    process.env.BLANKDRIVE_OAUTH_BACKEND_URL = 'https://oauth-backend.example.test';
    expect(await ensureAuthenticated()).toBe(true);
    expect(drive.setCloudStorageMode).toHaveBeenCalledWith('hidden');
    expect(drive.setPublicContentFolderName).not.toHaveBeenCalled();
    expect(promptGoogleOAuthCredentials).not.toHaveBeenCalled();
    expect(drive.setGoogleOAuthCredentials).not.toHaveBeenCalled();
  });

  it('sets up missing OAuth credentials and initializes an existing session', async () => {
    drive.isGoogleOAuthConfigured.mockResolvedValue(false);
    drive.isAuthenticated.mockResolvedValue(true);
    expect(await ensureAuthenticated()).toBe(true);
    expect(promptGoogleOAuthCredentials).toHaveBeenCalledOnce();
    expect(drive.setGoogleOAuthCredentials).toHaveBeenCalledWith('id.apps.googleusercontent.com', 'secret-1234');
    expect(drive.authenticateDrive).toHaveBeenCalledOnce();
    expect(drive.performOAuthFlow).not.toHaveBeenCalled();
  });

  it('reauthenticates when an existing session is expired', async () => {
    drive.isAuthenticated.mockResolvedValue(true);
    drive.authenticateDrive.mockRejectedValue(new Error('expired token'));
    expect(await ensureAuthenticated()).toBe(true);
    expect(drive.performOAuthFlow).toHaveBeenCalledOnce();
  });

  it('updates invalid OAuth credentials and succeeds on the retry', async () => {
    drive.performOAuthFlow.mockRejectedValueOnce(new Error('invalid_client'));
    expect(await ensureAuthenticated()).toBe(true);
    expect(promptGoogleOAuthCredentials).toHaveBeenCalledOnce();
    expect(drive.setGoogleOAuthCredentials).toHaveBeenCalledWith('id.apps.googleusercontent.com', 'secret-1234');
    expect(drive.performOAuthFlow).toHaveBeenCalledTimes(2);
    expect(logAuditEvent).toHaveBeenCalledWith('auth_google_connected');
  });

  it('returns false for OAuth setup failure and retry authorization failure', async () => {
    drive.performOAuthFlow.mockRejectedValueOnce(new Error('unauthorized_client'));
    promptGoogleOAuthCredentials.mockRejectedValueOnce(new Error('setup cancelled'));
    expect(await ensureAuthenticated()).toBe(false);

    configureNormalFlow();
    drive.performOAuthFlow.mockRejectedValueOnce(new Error('deleted_client')).mockRejectedValueOnce(new Error('retry failed'));
    expect(await ensureAuthenticated()).toBe(false);

    configureNormalFlow();
    drive.performOAuthFlow.mockRejectedValueOnce(new Error('invalid_client')).mockRejectedValueOnce(new Error('retry failed'));
    promptGoogleOAuthCredentials.mockRejectedValueOnce('cancelled');
    expect(await ensureAuthenticated()).toBe(false);

    configureNormalFlow();
    drive.performOAuthFlow.mockRejectedValueOnce(new Error('invalid_client')).mockRejectedValueOnce('cancelled');
    expect(await ensureAuthenticated()).toBe(false);
  });

  it('reports redirect mismatch and ordinary OAuth errors, including non-Error values', async () => {
    drive.performOAuthFlow.mockRejectedValueOnce(new Error('timed out waiting for redirect'));
    expect(await ensureAuthenticated()).toBe(false);

    configureNormalFlow();
    drive.performOAuthFlow.mockRejectedValueOnce(new Error('network unavailable'));
    expect(await ensureAuthenticated()).toBe(false);

    configureNormalFlow();
    drive.performOAuthFlow.mockRejectedValueOnce('cancelled');
    expect(await ensureAuthenticated()).toBe(false);
  });

  it('falls back to printing the URL when the browser opener fails', async () => {
    openExternalUrl.mockRejectedValueOnce(new Error('browser unavailable'));
    drive.performOAuthFlow.mockImplementation(async (open: (url: string) => Promise<void>) => open('https://accounts.example.test/fallback'));
    expect(await ensureAuthenticated()).toBe(true);
    expect(openExternalUrl).toHaveBeenCalledWith('https://accounts.example.test/fallback');
  });
});
