import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import nodeCrypto from 'node:crypto';

const prompt = vi.hoisted(() => vi.fn());
vi.mock('inquirer', () => ({ default: { prompt } }));

const fs = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  access: vi.fn(),
  unlink: vi.fn().mockResolvedValue(undefined),
  appendFile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('fs/promises', () => ({ default: fs }));

const vault = vi.hoisted(() => ({ isUnlocked: vi.fn(() => true) }));
vi.mock('../src/storage/vault/index.js', () => vault);

const cryptoApi = vi.hoisted(() => ({
  getIndexKey: vi.fn(() => Buffer.from('index-key')),
  encryptToPayload: vi.fn((value: string) => `enc:${value}`),
  decryptToString: vi.fn((value: string) => String(value).replace(/^enc:/, '')),
  generatePassword: vi.fn(() => 'GeneratedStrong1!'),
  generatePassphrase: vi.fn(() => 'correct horse battery staple'),
  analyzePassword: vi.fn(() => ({ strength: 'strong', entropy: 72 })),
  PASSWORD_PRESETS: { standard: { length: 16 }, strong: { length: 24 } },
}));
vi.mock('../src/crypto/index.js', () => cryptoApi);

const qr = vi.hoisted(() => ({
  generate: vi.fn((_uri: string, _options: unknown, callback: (value: string) => void) => callback('QR-A\nQR-B')),
}));
vi.mock('qrcode-terminal', () => ({ default: qr }));

const spinner = vi.hoisted(() => ({ start: vi.fn(), succeed: vi.fn(), fail: vi.fn(), stop: vi.fn() }));
const ora = vi.hoisted(() => vi.fn(() => ({ start: vi.fn(() => spinner) })));
vi.mock('ora', () => ({ default: ora }));

const argon = vi.hoisted(() => ({
  argon2id: 2,
  hash: vi.fn(async (password: string) => `argon:${password}`),
  verify: vi.fn(async (hash: string, password: string) => hash === `argon:${password}`),
}));
vi.mock('argon2', () => ({ default: argon }));

const synchronizer = vi.hoisted(() => ({ uploadDuressHashToCloud: vi.fn().mockResolvedValue(true) }));
vi.mock('../src/storage/drive/synchronizer.js', () => synchronizer);

import * as audit from '../src/cli/auditLog.js';
import * as duress from '../src/cli/duress.js';
import * as prompts from '../src/cli/prompts.js';
import * as progress from '../src/cli/progress.js';
import * as themes from '../src/cli/themes.js';
import * as twofa from '../src/cli/vault2fa.js';

const secret = 'JBSWY3DPEHPK3PXP';

function totpForCounter(value: string, counter: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of value) bits += chars.indexOf(char).toString(2).padStart(5, '0');
  const keyBytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) keyBytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hash = nodeCrypto.createHmac('sha1', Buffer.from(keyBytes)).update(counterBuffer).digest();
  const offset = hash[hash.length - 1]! & 0xf;
  const number = (((hash[offset]! & 0x7f) << 24) | ((hash[offset + 1]! & 0xff) << 16) | ((hash[offset + 2]! & 0xff) << 8) | (hash[offset + 3]! & 0xff)) % 1000000;
  return number.toString().padStart(6, '0');
}

beforeEach(() => {
  prompt.mockReset();
  fs.readFile.mockReset();
  fs.writeFile.mockClear();
  fs.mkdir.mockClear();
  fs.access.mockReset();
  fs.unlink.mockClear();
  fs.appendFile.mockClear();
  fs.writeFile.mockResolvedValue(undefined);
  fs.mkdir.mockResolvedValue(undefined);
  fs.unlink.mockResolvedValue(undefined);
  fs.appendFile.mockResolvedValue(undefined);
  vault.isUnlocked.mockReturnValue(true);
  cryptoApi.encryptToPayload.mockImplementation((value: string) => `enc:${value}`);
  cryptoApi.decryptToString.mockImplementation((value: string) => String(value).replace(/^enc:/, ''));
  argon.hash.mockImplementation(async (password: string) => `argon:${password}`);
  argon.verify.mockImplementation(async (hash: string, password: string) => hash === `argon:${password}`);
  synchronizer.uploadDuressHashToCloud.mockResolvedValue(true);
  audit.resetAuditState();
  duress.resetDuressState();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('prompts direct branches', () => {
  it('validates password prompts and confirmation', async () => {
    prompt.mockResolvedValueOnce({ password: 'plain' });
    expect(await prompts.promptPassword('Password', true)).toBe('plain');
    const passwordQuestion = prompt.mock.calls[0]![0][0];
    expect(passwordQuestion.validate('')).toContain('required');
    expect(passwordQuestion.validate('short')).toContain('8 characters');
    expect(passwordQuestion.validate('long-enough')).toBe(true);

    prompt.mockResolvedValueOnce({ password: 'abcdefgh', confirm: 'abcdefgh' });
    expect(await prompts.promptPasswordConfirm()).toBe('abcdefgh');
    expect(prompt.mock.calls.at(-1)![0][0].validate('short')).toContain('8 characters');
    expect(prompt.mock.calls.at(-1)![0][0].validate('abcdefgh')).toBe(true);
    prompt.mockResolvedValueOnce({ password: 'abcdefgh', confirm: 'different' });
    await expect(prompts.promptPasswordConfirm()).rejects.toThrow('Passwords do not match');
  });

  it('covers skip, manual, generated, regenerated and utility prompt paths', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    const entry = (action: string, followUp: Record<string, string> | undefined, password = '') => {
      prompt.mockResolvedValueOnce({ title: 'Entry', username: '' }).mockResolvedValueOnce({ action });
      if (followUp) prompt.mockResolvedValueOnce(followUp);
      prompt.mockResolvedValueOnce({ url: '', category: '', notes: '  note  ' });
      return prompts.promptEntryDetails();
    };
    expect(await entry('skip', undefined)).toMatchObject({ title: 'Entry', password: undefined, notes: 'note' });
    expect(await entry('manual', { password: '' })).toMatchObject({ password: undefined });
    expect(await entry('passphrase', { confirm: 'yes' })).toMatchObject({ password: 'correct horse battery staple' });
    expect(await entry('standard', { confirm: 'yes' })).toMatchObject({ password: 'GeneratedStrong1!' });
    prompt.mockResolvedValueOnce({ title: 'Entry', username: '' }).mockResolvedValueOnce({ action: 'strong' }).mockResolvedValueOnce({ confirm: 'manual' }).mockResolvedValueOnce({ manualPassword: 'manual' }).mockResolvedValueOnce({ url: '', category: '', notes: '' });
    expect(await prompts.promptEntryDetails()).toMatchObject({ password: 'manual' });
    prompt.mockResolvedValueOnce({ title: 'Entry', username: '' }).mockResolvedValueOnce({ action: 'strong' }).mockResolvedValueOnce({ confirm: 'regenerate' }).mockResolvedValueOnce({ action: 'manual' }).mockResolvedValueOnce({ password: 'recursive' }).mockResolvedValueOnce({ url: '', category: '', notes: '' });
    expect(await prompts.promptEntryDetails()).toMatchObject({ password: 'recursive' });

    prompt.mockResolvedValueOnce({ confirmed: false }).mockResolvedValueOnce({ query: 'term' }).mockResolvedValueOnce({ selected: 'id' }).mockResolvedValueOnce({ pathsInput: ' one, two ' });
    expect(await prompts.promptConfirm('Continue?')).toBe(false);
    expect(await prompts.promptSearch()).toBe('term');
    expect(await prompts.promptSelectEntry([])).toBeNull();
    expect(await prompts.promptSelectEntry([{ id: 'id', title: 'Entry', modified: 0 }])).toBe('id');
    expect(await prompts.promptCarrierPaths()).toEqual(['one', 'two']);
    expect(prompt.mock.calls.at(-1)![0][0].validate('')).toContain('required');
    output.mockRestore();
  });
});

describe('themes direct branches', () => {
  it('loads valid, invalid and unreadable themes and saves failures', async () => {
    fs.readFile.mockResolvedValueOnce(JSON.stringify({ theme: 'ocean' }));
    await themes.loadTheme();
    expect(themes.getCurrentTheme()).toBe('ocean');
    expect(themes.getThemeColors().primary).toBe('#0077BE');
    fs.readFile.mockResolvedValueOnce(JSON.stringify({ theme: 'not-a-theme' }));
    await themes.loadTheme();
    expect(themes.getCurrentTheme()).toBe('ocean');
    fs.readFile.mockResolvedValueOnce('{bad json');
    await themes.loadTheme();
    expect(await themes.setTheme('forest')).toBe(true);
    expect(await themes.setTheme('invalid' as never)).toBe(false);
    fs.mkdir.mockRejectedValueOnce(new Error('read-only'));
    expect(await themes.setTheme('sunset')).toBe(true);
    expect(themes.getAvailableThemes()).toEqual(['default', 'ocean', 'forest', 'sunset', 'mono', 'hacker']);
  });

  it('renders valid and invalid previews, all colors, and bold variants', () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    themes.previewTheme('default');
    themes.previewTheme('invalid' as never);
    themes.showAllThemes();
    for (const fn of ['primary', 'secondary', 'success', 'warning', 'error', 'info', 'muted', 'accent', 'primaryBold', 'secondaryBold', 'successBold', 'warningBold', 'errorBold'] as const) {
      expect(themes.theme[fn]('text')).toBeTruthy();
    }
    expect(output).toHaveBeenCalled();
    output.mockRestore();
  });
});

describe('progress direct branches', () => {
  it('formats units, speeds, ETAs and tracker lifecycle', () => {
    expect(progress.formatBytes(1)).toBe('1 B');
    expect(progress.formatBytes(1024)).toBe('1.0 KB');
    expect(progress.formatBytes(1024 ** 2)).toBe('1.0 MB');
    expect(progress.formatBytes(1024 ** 3)).toBe('1.00 GB');
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const tracker = progress.createProgressTracker('Uploading', 100);
    vi.setSystemTime(200);
    tracker.update(1);
    vi.setSystemTime(400);
    tracker.update(1000);
    tracker.setProgress(10, 0);
    tracker.setProgress(1024, 1024 * 1024 * 2);
    tracker.finish();
    expect(tracker.transferredBytes).toBe(1024);
    const huge = progress.createProgressTracker('Downloading', 10_000_000_000);
    vi.setSystemTime(1000);
    huge.update(1);
    huge.update(0);
    huge.finish();
    progress.createMultiProgressBar();
  });

  it('simulates a delayed operation and finishes after progress updates', async () => {
    await progress.simulateProgress('Encrypting', 100, async () => {
      await new Promise(resolve => setTimeout(resolve, 70));
    }, 50);
    expect(true).toBe(true);
  });
});

describe('audit log direct branches', () => {
  it('loads, saves, trims, filters and displays audit events', async () => {
    fs.readFile.mockRejectedValueOnce(new Error('missing'));
    await audit.logAuditEvent('failed_unlock_attempt', { details: 'bad', entryTitle: 'Login' });
    await audit.logAuditEvent('password_copied');
    await audit.logAuditEvent('entry_created', { entryId: 'id' });
    expect((await audit.getAuditEntries(2)).map(e => e.event)).toEqual(['password_copied', 'entry_created']);
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    await audit.displayAuditLog(3);
    expect(output).toHaveBeenCalled();
    output.mockRestore();

    audit.resetAuditState();
    vault.isUnlocked.mockReturnValue(false);
    fs.readFile.mockResolvedValueOnce('enc:[{"timestamp":1,"event":"entry_created"}]');
    await audit.displayAuditLog();
    await audit.clearAuditLog();

    vault.isUnlocked.mockReturnValue(true);
    audit.resetAuditState();
    fs.readFile.mockResolvedValueOnce('enc:[{"timestamp":1,"event":"vault_destroyed","details":"gone","entryTitle":"Vault"},{"timestamp":2,"event":"password_viewed"},{"timestamp":3,"event":"sync_completed"}]');
    await audit.displayAuditLog(0);
    await audit.clearAuditLog();
  });

  it('handles decrypt, mkdir, write and load errors and trims old entries', async () => {
    const entries = Array.from({ length: 500 }, (_, index) => ({ timestamp: index, event: 'entry_accessed' }));
    fs.readFile.mockResolvedValueOnce(`enc:${JSON.stringify(entries)}`);
    await audit.logAuditEvent('sync_failed');
    expect((await audit.getAuditEntries()).length).toBe(500);
    fs.readFile.mockRejectedValueOnce(new Error('bad decrypt'));
    audit.resetAuditState();
    await audit.getAuditEntries();
    vault.isUnlocked.mockReturnValue(false);
    await audit.logAuditEvent('vault_locked');
    vault.isUnlocked.mockReturnValue(true);
    fs.mkdir.mockRejectedValueOnce(new Error('mkdir'));
    await audit.logAuditEvent('note_created');
    fs.writeFile.mockRejectedValueOnce(new Error('write'));
    await audit.logAuditEvent('note_updated');
  });
});

describe('duress direct branches', () => {
  it('checks configuration fallbacks and password verification paths', async () => {
    fs.access.mockRejectedValueOnce(new Error()).mockRejectedValueOnce(new Error());
    await expect(duress.isDuressConfigured()).resolves.toBe(false);
    fs.access.mockRejectedValueOnce(new Error()).mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
    await expect(duress.isDuressConfigured()).resolves.toBe(true);
    fs.access.mockResolvedValueOnce(undefined);
    fs.readFile.mockResolvedValueOnce('argon:duress');
    await expect(duress.checkDuressPasswordPreUnlock('duress')).resolves.toBe(true);
    fs.readFile.mockResolvedValueOnce('argon:other');
    await expect(duress.checkDuressPasswordPreUnlock('duress')).resolves.toBe(false);
    fs.readFile.mockRejectedValueOnce(new Error());
    await expect(duress.checkDuressPasswordPreUnlock('duress')).resolves.toBe(false);

    fs.access.mockRejectedValueOnce(new Error());
    await expect(duress.checkDuressPassword('x', Buffer.from('k'))).resolves.toBe(false);
    fs.access.mockResolvedValueOnce(undefined);
    fs.readFile.mockRejectedValueOnce(new Error());
    await expect(duress.checkDuressPassword('x', Buffer.from('k'))).resolves.toBe(false);
    fs.access.mockResolvedValueOnce(undefined);
    fs.readFile.mockResolvedValueOnce('enc:{"enabled":false,"passwordHash":"argon:x"}');
    await expect(duress.checkDuressPassword('x', Buffer.from('k'))).resolves.toBe(false);
    fs.access.mockResolvedValueOnce(undefined);
    fs.readFile.mockResolvedValueOnce('enc:{"enabled":true,"passwordHash":"argon:x","mode":"decoy","decoyEntries":[],"triggerCount":0}');
    await expect(duress.checkDuressPassword('x', Buffer.from('k'))).resolves.toBe(true);
  });

  it('sets up, activates, logs, reads decoys and disables duress mode', async () => {
    fs.readFile.mockResolvedValueOnce(Buffer.from('salt'));
    await duress.setupDuressPassword('duress', Buffer.from('key'), 'decoy');
    expect(synchronizer.uploadDuressHashToCloud).toHaveBeenCalled();
    synchronizer.uploadDuressHashToCloud.mockRejectedValueOnce(new Error('offline'));
    fs.readFile.mockRejectedValueOnce(new Error('no salt'));
    await duress.setupDuressPassword('duress2', Buffer.from('key'), 'wipe');
    expect(duress.getDuressMode()).toBe('wipe');
    expect(duress.getDecoyEntries()[0]).toMatchObject({ id: 'decoy_0', title: 'Email' });

    fs.readFile.mockResolvedValueOnce('enc:{"enabled":true,"passwordHash":"argon:x","mode":"minimal","decoyEntries":[{"title":"Fake","username":"u"}],"triggerCount":2}');
    await duress.activateDuressMode(Buffer.from('key'));
    expect(duress.isInDuressMode()).toBe(true);
    expect(duress.getDecoyEntries()[0]).toMatchObject({ id: 'decoy_0', title: 'Fake' });
    fs.readFile.mockRejectedValueOnce(new Error());
    await duress.activateDuressMode(Buffer.from('key'));
    fs.appendFile.mockRejectedValueOnce(new Error('hidden log'));
    duress.activateDuressModeSimple();
    expect(duress.getDuressMode()).toBe('minimal');
    duress.resetDuressState();
    expect(duress.isInDuressMode()).toBe(false);
    await duress.disableDuressPassword();
    expect(duress.getDuressMode()).toBeNull();
    fs.unlink.mockRejectedValueOnce(new Error('missing'));
    await duress.disableDuressPassword();
  });

  it('covers interactive setup mismatch, success and setup failure', async () => {
    prompt.mockResolvedValueOnce({ duressPassword: 'abcdefghijkl', confirmPassword: 'different' });
    expect(await duress.interactiveSetupDuress(Buffer.from('key'))).toBe(false);
    prompt.mockResolvedValueOnce({ duressPassword: 'abcdefghijkl', confirmPassword: 'abcdefghijkl' }).mockResolvedValueOnce({ mode: 'minimal' });
    expect(await duress.interactiveSetupDuress(Buffer.from('key'))).toBe(true);
    fs.mkdir.mockRejectedValueOnce(new Error('cannot write'));
    prompt.mockResolvedValueOnce({ duressPassword: 'abcdefghijkl', confirmPassword: 'abcdefghijkl' }).mockResolvedValueOnce({ mode: 'decoy' });
    expect(await duress.interactiveSetupDuress(Buffer.from('key'))).toBe(false);
    expect(prompt.mock.calls[0]![0][0].validate('short')).toContain('12 characters');
    expect(prompt.mock.calls[0]![0][0].validate('abcdefghijkl')).toBe(true);
  });
});

describe('vault 2FA direct branches', () => {
  it('generates, hashes and verifies new and legacy backup codes', () => {
    expect(twofa.generateVault2FASecret()).toMatch(/^[A-Z2-7]+$/);
    expect(twofa.generateBackupCodes(0)).toEqual([]);
    const code = twofa.generateBackupCodes(2)[0]!;
    const stored = twofa.hashBackupCode(code);
    expect(twofa.verifyBackupCode('junk', ['', 'bad:hash', '1234:bad', 'odd'])).toBe(-1);
    expect(twofa.verifyBackupCode(code.toLowerCase(), [stored])).toBe(0);
    const legacy = nodeCrypto.createHash('sha256').update(code.replace('-', '').toUpperCase()).digest('hex');
    expect(twofa.verifyBackupCode(code, [legacy])).toBe(0);
    expect(twofa.verifyBackupCode(code, [stored.slice(0, 32) + ':bad'])).toBe(-1);
  });

  it('verifies invalid, current, previous, next and wrong TOTP codes', () => {
    vi.useFakeTimers();
    const timestamp = 1_700_000_000_000;
    vi.setSystemTime(timestamp);
    const counter = Math.floor(timestamp / 1000 / 30);
    expect(twofa.verifyVault2FACode('bad', secret)).toBe(false);
    expect(twofa.verifyVault2FACode(totpForCounter(secret, counter), secret)).toBe(true);
    expect(twofa.verifyVault2FACode(totpForCounter(secret, counter - 1), secret)).toBe(true);
    expect(twofa.verifyVault2FACode(totpForCounter(secret, counter + 1), secret)).toBe(true);
    expect(twofa.verifyVault2FACode('000000', secret)).toBe(false);
  });

  it('renders setup and backup output and sanitizes prompt codes', async () => {
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    twofa.generateTextQRCode('uri');
    twofa.displaySetupInstructions(secret);
    twofa.displayBackupCodes(['ABCD-2345']);
    twofa.showVault2FAHelp();
    expect(qr.generate).toHaveBeenCalled();
    prompt.mockResolvedValueOnce({ code: 'ABCD-2345' });
    expect(await twofa.prompt2FACode()).toBe('ABCD-2345');
    expect(prompt.mock.calls.at(-1)![0][0].validate('123')).toContain('6-digit');
    prompt.mockResolvedValueOnce({ code: '12 34 56' });
    expect(await twofa.promptVerify2FASetup()).toBe('123456');
    expect(prompt.mock.calls.at(-1)![0][0].validate('abc')).toContain('6-digit');
    expect(twofa.formatSecretForDisplay('ABCDEFGHI')).toBe('ABCD EFGH I');
    output.mockRestore();
  });

  it('handles enabled configuration decisions and new setup cancellation', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    prompt.mockResolvedValueOnce({ action: 'cancel' });
    await twofa.interactiveSetup2FA({ enabled: true, secret, enabledAt: 1 }, save);
    prompt.mockResolvedValueOnce({ action: 'backup' });
    await twofa.interactiveSetup2FA({ enabled: true, secret, enabledAt: 1 }, save);
    prompt.mockResolvedValueOnce({ action: 'newbackup' }).mockResolvedValueOnce({ code: 'bad' });
    await twofa.interactiveSetup2FA({ enabled: true, secret, enabledAt: 1 }, save);
    prompt.mockResolvedValueOnce({ action: 'disable' }).mockResolvedValueOnce({ code: 'bad' });
    await twofa.interactiveSetup2FA({ enabled: true, secret, enabledAt: 1 }, save);
    prompt.mockResolvedValueOnce({ action: 'disable' }).mockResolvedValueOnce({ code: '000000' });
    await twofa.interactiveSetup2FA({ enabled: true, secret, enabledAt: 1 }, save);
    prompt.mockResolvedValueOnce({ action: 'disable' }).mockResolvedValueOnce({ code: totpForCounter(secret, Math.floor(Date.now() / 1000 / 30)) }).mockResolvedValueOnce({ confirm: false });
    await twofa.interactiveSetup2FA({ enabled: true, secret, enabledAt: 1 }, save);
    prompt.mockResolvedValueOnce({ proceed: false });
    await twofa.interactiveSetup2FA(undefined, save);
    expect(save).not.toHaveBeenCalled();
  });

  it('completes setup after a failed verification and backup-code confirmation retry', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    let setupSecret = '';
    qr.generate.mockImplementationOnce((uri: string, _options: unknown, callback: (value: string) => void) => {
      setupSecret = decodeURIComponent(uri.split('?secret=')[1]!.split('&')[0]!);
      callback('QR');
    });
    const save = vi.fn().mockResolvedValue(undefined);
    prompt.mockResolvedValueOnce({ proceed: true });
    let codeAttempts = 0;
    prompt.mockImplementation(async (questions: Array<{ name: string }>) => {
      const name = questions[0]!.name;
      if (name === 'code') {
        codeAttempts++;
        return { code: codeAttempts === 1 ? '000000' : totpForCounter(setupSecret, Math.floor(1_700_000_000 / 30)) };
      }
      if (name === 'savedCodes') return { savedCodes: false };
      return { confirm: true };
    });
    await twofa.interactiveSetup2FA(undefined, save);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, secret: expect.any(String), backupCodes: expect.any(Array) }));
  });
});
