import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const commands = vi.hoisted(() => ({
  initCommand: vi.fn(), addCommand: vi.fn(), getCommand: vi.fn(), listCommand: vi.fn(),
  deleteCommand: vi.fn(), editCommand: vi.fn(), favoriteCommand: vi.fn(), listFavoritesCommand: vi.fn(),
  noteCommand: vi.fn(), auditCommand: vi.fn(), statusCommand: vi.fn(), lockCommand: vi.fn(),
  authCommand: vi.fn(), uploadCommand: vi.fn(), downloadCommand: vi.fn(), destructCommand: vi.fn(),
  generateCommand: vi.fn(), totpCommand: vi.fn(), syncCommand: vi.fn(), settingsCommand: vi.fn(),
  webCommand: vi.fn(), desktopCommand: vi.fn(), updateCommand: vi.fn(),
}));
const fs = vi.hoisted(() => ({
  readFile: vi.fn(), mkdir: vi.fn().mockResolvedValue(undefined), writeFile: vi.fn().mockResolvedValue(undefined),
}));
const readline = vi.hoisted(() => ({ createInterface: vi.fn() }));
const inquirer = vi.hoisted(() => ({ prompt: vi.fn() }));
const ora = vi.hoisted(() => ({
  start: vi.fn(), stop: vi.fn(), succeed: vi.fn(), fail: vi.fn(), text: '',
}));
const vault = vi.hoisted(() => ({
  vaultExists: vi.fn(), isUnlocked: vi.fn(), unlock: vi.fn(), lock: vi.fn(),
  getEntry: vi.fn(), listEntries: vi.fn(), getVault2FAConfig: vi.fn(), setVault2FAConfig: vi.fn(),
  useBackupCode: vi.fn(),
}));
const crypto = vi.hoisted(() => ({ getIndexKey: vi.fn(), initializeKeyManager: vi.fn() }));
const duress = vi.hoisted(() => ({
  isDuressConfigured: vi.fn(), interactiveSetupDuress: vi.fn(), disableDuressPassword: vi.fn(),
  isInDuressMode: vi.fn(), checkDuressPasswordPreUnlock: vi.fn(), activateDuressModeSimple: vi.fn(),
}));
const autoLock = vi.hoisted(() => ({
  resetAutoLockTimer: vi.fn(), startAutoLockTimer: vi.fn(), stopAutoLockTimer: vi.fn(),
  setAutoLockTimeout: vi.fn(), getAutoLockSettings: vi.fn(),
}));
const themes = vi.hoisted(() => ({
  setTheme: vi.fn(), getAvailableThemes: vi.fn(), showAllThemes: vi.fn(), loadTheme: vi.fn(), getCurrentTheme: vi.fn(),
}));
const audit = vi.hoisted(() => ({ displayAuditLog: vi.fn(), logAuditEvent: vi.fn() }));
const breach = vi.hoisted(() => ({
  checkPasswordBreach: vi.fn(), displayBreachResult: vi.fn(), getBreachDisplay: vi.fn(), formatBreachCount: vi.fn(),
}));
const twofa = vi.hoisted(() => ({
  interactiveSetup2FA: vi.fn(), showVault2FAHelp: vi.fn(), prompt2FACode: vi.fn(),
  verifyVault2FACode: vi.fn(), verifyBackupCode: vi.fn(),
}));
const prompts = vi.hoisted(() => ({ promptPassword: vi.fn() }));
if (typeof process.stdin.setRawMode !== 'function') Object.assign(process.stdin, { setRawMode: vi.fn() });

vi.mock('../src/cli/commands/index.js', () => commands);
vi.mock('fs/promises', () => ({ default: fs }));
vi.mock('readline', () => ({ default: readline }));
vi.mock('inquirer', () => ({ default: inquirer, Separator: class Separator {} }));
vi.mock('ora', () => ({ default: vi.fn(() => ora) }));
vi.mock('../src/storage/vault/index.js', () => vault);
vi.mock('../src/crypto/index.js', () => crypto);
vi.mock('../src/cli/duress.js', () => duress);
vi.mock('../src/cli/autoLock.js', () => autoLock);
vi.mock('../src/cli/themes.js', () => themes);
vi.mock('../src/cli/auditLog.js', () => audit);
vi.mock('../src/cli/breachCheck.js', () => breach);
vi.mock('../src/cli/vault2fa.js', () => twofa);
vi.mock('../src/cli/prompts.js', () => prompts);

import { startShell } from '../src/cli/shell.js';

const exitSignal = (code: number) => Object.assign(new Error(`exit ${code}`), { code });

function queueInputs(inputs: string[]) {
  let index = 0;
  readline.createInterface.mockImplementation((options: { completer?: (line: string) => unknown }) => {
    (queueInputs as typeof queueInputs & { lastOptions?: unknown }).lastOptions = options;
    return {
      question: vi.fn((_prompt: string, callback: (answer: string) => void) => callback(inputs[index++] ?? 'exit')),
      close: vi.fn(), history: [],
    };
  });
}

function mockExit() {
  return vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw exitSignal(code ?? 0);
  }) as never);
}

async function runShell(): Promise<unknown> {
  try {
    return await startShell();
  } catch (error) {
    return error;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  commands.initCommand.mockResolvedValue(undefined); commands.addCommand.mockResolvedValue(undefined);
  commands.getCommand.mockResolvedValue(undefined); commands.listCommand.mockResolvedValue(undefined);
  commands.deleteCommand.mockResolvedValue(undefined); commands.editCommand.mockResolvedValue(undefined);
  commands.favoriteCommand.mockResolvedValue(undefined); commands.listFavoritesCommand.mockResolvedValue(undefined);
  commands.noteCommand.mockResolvedValue(undefined); commands.auditCommand.mockResolvedValue(undefined);
  commands.statusCommand.mockResolvedValue(undefined); commands.lockCommand.mockResolvedValue(undefined);
  commands.authCommand.mockResolvedValue(undefined); commands.uploadCommand.mockResolvedValue(undefined);
  commands.downloadCommand.mockResolvedValue(undefined); commands.destructCommand.mockResolvedValue(undefined);
  commands.generateCommand.mockResolvedValue(undefined); commands.totpCommand.mockResolvedValue(undefined);
  commands.syncCommand.mockResolvedValue(undefined); commands.settingsCommand.mockResolvedValue(undefined);
  commands.webCommand.mockResolvedValue(undefined); commands.desktopCommand.mockResolvedValue(undefined);
  commands.updateCommand.mockResolvedValue(undefined);
  fs.readFile.mockRejectedValue(new Error('history missing'));
  vi.spyOn(console, 'clear').mockImplementation(() => undefined);
  vault.vaultExists.mockResolvedValue(true); vault.isUnlocked.mockReturnValue(true);
  vault.unlock.mockResolvedValue(undefined); vault.listEntries.mockResolvedValue([]); vault.getEntry.mockResolvedValue(undefined);
  vault.getVault2FAConfig.mockReturnValue(null); vault.setVault2FAConfig.mockResolvedValue(undefined); vault.useBackupCode.mockResolvedValue(undefined);
  crypto.getIndexKey.mockReturnValue(Buffer.alloc(32));
  duress.isDuressConfigured.mockResolvedValue(false); duress.interactiveSetupDuress.mockResolvedValue(undefined);
  duress.disableDuressPassword.mockResolvedValue(undefined); duress.isInDuressMode.mockReturnValue(false);
  duress.checkDuressPasswordPreUnlock.mockResolvedValue(false);
  autoLock.getAutoLockSettings.mockReturnValue({ enabled: true, timeoutMinutes: 15 });
  themes.loadTheme.mockResolvedValue(undefined); themes.getAvailableThemes.mockReturnValue(['default', 'ocean']);
  themes.getCurrentTheme.mockReturnValue('default'); themes.setTheme.mockResolvedValue(undefined);
  audit.displayAuditLog.mockResolvedValue(undefined); audit.logAuditEvent.mockResolvedValue(undefined);
  breach.checkPasswordBreach.mockResolvedValue({ breached: false, count: 0 });
  breach.getBreachDisplay.mockReturnValue({ icon: '!', color: (value: string) => value });
  breach.formatBreachCount.mockReturnValue('0');
  twofa.interactiveSetup2FA.mockResolvedValue(undefined); twofa.showVault2FAHelp.mockReturnValue(undefined);
  twofa.prompt2FACode.mockResolvedValue('123456'); twofa.verifyVault2FACode.mockReturnValue(true);
  twofa.verifyBackupCode.mockReturnValue(-1);
  prompts.promptPassword.mockResolvedValue('password');
  ora.start.mockReturnValue(ora); ora.text = '';
  queueInputs(['exit']);
});

describe('shell command dispatch and terminal helpers', () => {
  it('dispatches command aliases and option branches, including history/help/clear/unknown', async () => {
    queueInputs([
      'init -r -d', 'add', 'gen -p -l 20 --preset strong --no-symbols -c',
      'ls -f title -t password -c work', 'get title -c -s', 'edit title', 'fav title', 'favs',
      'note add my note', 'otp view token -c', '2fa add token', '2fa --help', 'breach --all',
      'audit -a', 'rm title -f', 'up file.txt', 'dl title', 'autolock nope', 'autolock 0',
      'autolock 2', 'autolock', 'theme ocean', 'theme unknown', 'theme', 'history', 'log 4',
      'auth --setup -l', 'sync --force --status --conflicts', 'settings --storage hidden --folder vault-data',
      'ui --open --port 4310', 'desktop -r v1 --output x --asset linux --force --install -y',
      'update -c -i -r v2 --current-version v1 --asset a --output o -f -y --json --scheduled',
      'status', 'lock', 'destruct', 'version', 'help --list', 'clear', 'wat', '', 'exit',
    ]);
    const exit = mockExit();
    await runShell();
    expect(commands.initCommand).toHaveBeenCalledWith({ restore: true, drive: true });
    expect(commands.generateCommand).toHaveBeenCalledWith({ length: 20, preset: 'strong', passphrase: true, copy: true, noSymbols: true });
    expect(commands.listCommand).toHaveBeenCalledWith({ filter: 'title', type: 'password', category: 'work' });
    expect(commands.getCommand).toHaveBeenCalledWith('title', { copy: true, showPassword: true });
    expect(commands.noteCommand).toHaveBeenCalledWith('add', 'my note');
    expect(commands.totpCommand).toHaveBeenCalledWith('view', 'token -c', { copy: true });
    expect(commands.totpCommand).toHaveBeenCalledWith('add', 'token', {});
    expect(commands.desktopCommand).toHaveBeenCalledWith({ release: 'v1', output: 'x', asset: 'linux', force: true, install: true, nonInteractive: true });
    expect(commands.updateCommand).toHaveBeenCalledWith({ check: true, install: true, release: 'v2', currentVersion: 'v1', asset: 'a', output: 'o', force: true, yes: true, json: true, scheduled: true });
    expect(console.clear).toHaveBeenCalled();
    exit.mockRestore();
  });

  it('exercises tab completion exact, partial, and missing matches', async () => {
    const exit = mockExit();
    await runShell();
    const completer = (queueInputs as typeof queueInputs & { lastOptions?: { completer?: (line: string) => unknown } }).lastOptions?.completer;
    expect(completer).toBeDefined();
    expect(completer?.('sta')).toEqual([['status'], 'sta']);
    expect(completer?.('status')).toEqual([['status '], 'status']);
    expect(completer?.('not-a-command')).toEqual([[], 'not-a-command']);
    exit.mockRestore();
  });

  it('loads, displays, and saves command history', async () => {
    fs.readFile.mockResolvedValue('old\nnew\n');
    queueInputs(['history 1', 'exit']);
    const exit = mockExit();
    await runShell();
    expect(fs.readFile).toHaveBeenCalled();
    expect(fs.mkdir).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalledWith(expect.stringContaining('.slasshy'), expect.stringContaining('history 1'), 'utf-8');
    exit.mockRestore();
  });
});

describe('shell help, errors, and exit paths', () => {
  it('runs interactive help, backs out, lists text help, and exits the picker', async () => {
    const previousIn = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
    const previousOut = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
    Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true });
    queueInputs(['help', 'exit']);
    inquirer.prompt
      .mockResolvedValueOnce({ category: 'common' })
      .mockResolvedValueOnce({ selected: '__back' })
      .mockResolvedValueOnce({ category: 'Vault' })
      .mockResolvedValueOnce({ selected: 'status' })
      .mockResolvedValueOnce({ action: 'list' })
      .mockResolvedValueOnce({ category: 'exit' });
    const exit = mockExit();
    await runShell();
    expect(inquirer.prompt).toHaveBeenCalled();
    exit.mockRestore();
    if (previousIn) Object.defineProperty(process.stdin, 'isTTY', previousIn); else delete (process.stdin as NodeJS.ReadStream & { isTTY?: boolean }).isTTY;
    if (previousOut) Object.defineProperty(process.stdout, 'isTTY', previousOut); else delete (process.stdout as NodeJS.WriteStream & { isTTY?: boolean }).isTTY;
  });

  it('reports command failures without stopping the shell', async () => {
    commands.statusCommand.mockRejectedValueOnce(new Error('status failed'));
    queueInputs(['status', 'exit']);
    const exit = mockExit();
    await runShell();
    expect(commands.statusCommand).toHaveBeenCalled();
    exit.mockRestore();
  });

  it('handles a cancelled password prompt by taking the clean exit path', async () => {
    vault.isUnlocked.mockReturnValue(false);
    prompts.promptPassword.mockRejectedValueOnce(new Error('prompt cancelled'));
    const exit = mockExit();
    await expect(startShell()).rejects.toMatchObject({ code: 0 });
    expect(exit).toHaveBeenCalledWith(0);
    exit.mockRestore();
  });

  it('allows the pre-vault help path and exits before creating a vault', async () => {
    vault.vaultExists.mockResolvedValue(false);
    queueInputs(['help', 'exit']);
    const exit = mockExit();
    await expect(startShell()).rejects.toMatchObject({ code: 0 });
    expect(commands.initCommand).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
    exit.mockRestore();
  });
});

describe('shell unlock, duress, 2FA, and destruct paths', () => {
  it('retries a bad password, then unlocks through a valid 2FA code', async () => {
    vault.isUnlocked.mockReturnValue(false);
    vault.unlock.mockRejectedValueOnce(new Error('bad password')).mockResolvedValueOnce(undefined);
    vault.getVault2FAConfig.mockReturnValue({ enabled: true, secret: 'SECRET', backupCodes: [] });
    prompts.promptPassword.mockResolvedValueOnce('wrong').mockResolvedValueOnce('right');
    twofa.prompt2FACode.mockResolvedValueOnce('bad').mockResolvedValueOnce('123456');
    twofa.verifyVault2FACode.mockReturnValueOnce(false).mockReturnValueOnce(true);
    queueInputs(['exit']);
    const exit = mockExit();
    await runShell();
    expect(vault.unlock).toHaveBeenCalledWith('right');
    expect(twofa.prompt2FACode).toHaveBeenCalledTimes(2);
    expect(audit.logAuditEvent).toHaveBeenCalledWith('failed_unlock_attempt');
    expect(audit.logAuditEvent).toHaveBeenCalledWith('vault_unlocked');
    exit.mockRestore();
  });

  it('accepts a valid backup code and consumes it', async () => {
    vault.isUnlocked.mockReturnValue(false);
    vault.getVault2FAConfig.mockReturnValue({ enabled: true, secret: 'SECRET', backupCodes: ['hash'] });
    twofa.prompt2FACode.mockResolvedValue('ABCD-EFGH');
    twofa.verifyBackupCode.mockReturnValue(0);
    queueInputs(['exit']);
    const exit = mockExit();
    await runShell();
    expect(vault.useBackupCode).toHaveBeenCalledWith(0);
    expect(audit.logAuditEvent).toHaveBeenCalledWith('vault_unlocked_backup_code');
    exit.mockRestore();
  });

  it('activates duress mode when the duress password is entered', async () => {
    vault.isUnlocked.mockReturnValue(false);
    duress.checkDuressPasswordPreUnlock.mockResolvedValue(true);
    prompts.promptPassword.mockResolvedValue('duress-password');
    queueInputs(['exit']);
    const exit = mockExit();
    await runShell();
    expect(duress.activateDuressModeSimple).toHaveBeenCalled();
    expect(vault.unlock).not.toHaveBeenCalled();
    exit.mockRestore();
  });

  it('offers destruct confirmation from the unlock prompt', async () => {
    vault.isUnlocked.mockReturnValue(false);
    prompts.promptPassword.mockResolvedValue('destruct');
    inquirer.prompt.mockResolvedValueOnce({ runDestruct: true });
    const exit = mockExit();
    await expect(startShell()).rejects.toMatchObject({ code: 0 });
    expect(inquirer.prompt).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
    exit.mockRestore();
  });

  it('locks and exits after three failed 2FA attempts', async () => {
    vault.isUnlocked.mockReturnValue(false);
    vault.getVault2FAConfig.mockReturnValue({ enabled: true, secret: 'SECRET', backupCodes: [] });
    twofa.prompt2FACode.mockResolvedValue('bad-code');
    twofa.verifyVault2FACode.mockReturnValue(false);
    const exit = mockExit();
    await runShell();
    expect(vault.lock).toHaveBeenCalled();
    expect(audit.logAuditEvent).toHaveBeenCalledWith('failed_2fa_attempt');
    exit.mockRestore();
  });
});
