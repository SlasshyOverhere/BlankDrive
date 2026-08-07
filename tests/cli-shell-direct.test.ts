import { beforeEach, describe, expect, it, vi } from 'vitest';

const commands = vi.hoisted(() => ({
  initCommand: vi.fn().mockResolvedValue(undefined),
  addCommand: vi.fn().mockResolvedValue(undefined),
  getCommand: vi.fn().mockResolvedValue(undefined),
  listCommand: vi.fn().mockResolvedValue(undefined),
  deleteCommand: vi.fn().mockResolvedValue(undefined),
  editCommand: vi.fn().mockResolvedValue(undefined),
  favoriteCommand: vi.fn().mockResolvedValue(undefined),
  listFavoritesCommand: vi.fn().mockResolvedValue(undefined),
  noteCommand: vi.fn().mockResolvedValue(undefined),
  auditCommand: vi.fn().mockResolvedValue(undefined),
  statusCommand: vi.fn().mockResolvedValue(undefined),
  lockCommand: vi.fn().mockResolvedValue(undefined),
  authCommand: vi.fn().mockResolvedValue(undefined),
  uploadCommand: vi.fn().mockResolvedValue(undefined),
  downloadCommand: vi.fn().mockResolvedValue(undefined),
  destructCommand: vi.fn().mockResolvedValue(undefined),
  generateCommand: vi.fn().mockResolvedValue(undefined),
  totpCommand: vi.fn().mockResolvedValue(undefined),
  syncCommand: vi.fn().mockResolvedValue(undefined),
  settingsCommand: vi.fn().mockResolvedValue(undefined),
  webCommand: vi.fn().mockResolvedValue(undefined),
  updateCommand: vi.fn().mockResolvedValue(undefined),
}));
const fs = vi.hoisted(() => ({ readFile: vi.fn().mockRejectedValue(new Error('missing')), mkdir: vi.fn(), writeFile: vi.fn() }));
const readline = vi.hoisted(() => ({ createInterface: vi.fn() }));
const vault = vi.hoisted(() => ({ isUnlocked: vi.fn(() => true), unlock: vi.fn().mockResolvedValue(undefined), getEntry: vi.fn(), listEntries: vi.fn(), vaultExists: vi.fn().mockResolvedValue(true), getVault2FAConfig: vi.fn().mockReturnValue(null), setVault2FAConfig: vi.fn() }));
const crypto = vi.hoisted(() => ({ getIndexKey: vi.fn(() => Buffer.alloc(32)), initializeKeyManager: vi.fn() }));
const duress = vi.hoisted(() => ({ isDuressConfigured: vi.fn().mockResolvedValue(false), interactiveSetupDuress: vi.fn(), disableDuressPassword: vi.fn(), isInDuressMode: vi.fn(() => false), checkDuressPasswordPreUnlock: vi.fn().mockResolvedValue(false), activateDuressModeSimple: vi.fn() }));
const autoLock = vi.hoisted(() => ({ resetAutoLockTimer: vi.fn(), startAutoLockTimer: vi.fn(), stopAutoLockTimer: vi.fn(), setAutoLockTimeout: vi.fn(), getAutoLockSettings: vi.fn(() => ({ enabled: true, timeoutMinutes: 15 })) }));
const themes = vi.hoisted(() => ({ setTheme: vi.fn(), getCurrentTheme: vi.fn(() => 'default'), getAvailableThemes: vi.fn(() => ['default', 'ocean']), showAllThemes: vi.fn(), loadTheme: vi.fn() }));
const audit = vi.hoisted(() => ({ displayAuditLog: vi.fn(), logAuditEvent: vi.fn().mockResolvedValue(undefined) }));
const breach = vi.hoisted(() => ({ checkPasswordBreach: vi.fn(), displayBreachResult: vi.fn(), getBreachDisplay: vi.fn(), formatBreachCount: vi.fn() }));
const twofa = vi.hoisted(() => ({ interactiveSetup2FA: vi.fn(), showVault2FAHelp: vi.fn() }));
const prompts = vi.hoisted(() => ({ promptPassword: vi.fn().mockResolvedValue('password') }));
const inquirer = vi.hoisted(() => ({ prompt: vi.fn() }));
const ora = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn(), succeed: vi.fn(), fail: vi.fn() }));

vi.mock('../src/cli/commands/index.js', () => commands);
vi.mock('fs/promises', () => ({ default: fs }));
vi.mock('readline', () => ({ default: readline }));
vi.mock('ora', () => ({ default: vi.fn(() => ora) }));
vi.mock('inquirer', () => ({ default: inquirer }));
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

describe('shell direct behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vault.vaultExists.mockResolvedValue(true);
    vault.isUnlocked.mockReturnValue(true);
    themes.loadTheme.mockResolvedValue(undefined);
    fs.readFile.mockRejectedValue(new Error('missing'));
    const rl = { question: vi.fn((_prompt: string, cb: (answer: string) => void) => cb('exit')), close: vi.fn(), history: [] };
    readline.createInterface.mockReturnValue(rl);
  });

  it('starts an already-unlocked shell and exits from the interactive prompt', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    await startShell();
    expect(readline.createInterface).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
    exit.mockRestore();
  });

  it('routes commands and parses aliases/options through the shell loop', async () => {
    const answers = ['generate -p -w 7 -c', 'ls -f Example -t passwords -c work', 'exit'];
    let index = 0;
    readline.createInterface.mockImplementation(() => ({
      question: vi.fn((_prompt: string, cb: (answer: string) => void) => cb(answers[index++] ?? 'exit')),
      close: vi.fn(),
      history: [],
    }));
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    await startShell();
    expect(commands.generateCommand).toHaveBeenCalledWith({ passphrase: true, words: 7, copy: true });
    expect(commands.listCommand).toHaveBeenCalledWith({ filter: 'Example', type: 'passwords', category: 'work' });
    exit.mockRestore();
  });

  it('handles unknown commands, help, invalid autolock, themes, and command errors', async () => {
    const answers = ['wat', 'help --list', 'autolock nope', 'theme unknown', 'status', 'exit'];
    let index = 0;
    readline.createInterface.mockImplementation(() => ({
      question: vi.fn((_prompt: string, cb: (answer: string) => void) => cb(answers[index++] ?? 'exit')),
      close: vi.fn(),
      history: [],
    }));
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    await startShell();
    expect(commands.statusCommand).toHaveBeenCalled();
    expect(themes.getAvailableThemes).toHaveBeenCalled();
    exit.mockRestore();
  });

  it('restricts a missing-vault shell to init and then continues after creation', async () => {
    const answers = ['help', 'init --restore', 'exit'];
    let index = 0;
    vault.vaultExists.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    readline.createInterface.mockImplementation(() => ({
      question: vi.fn((_prompt: string, cb: (answer: string) => void) => cb(answers[index++] ?? 'exit')),
      close: vi.fn(),
      history: [],
    }));
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    await startShell();
    expect(commands.initCommand).toHaveBeenCalledWith({ restore: true });
    exit.mockRestore();
  });
});
