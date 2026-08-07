import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';

const prompt = vi.hoisted(() => vi.fn());
vi.mock('inquirer', () => ({ default: { prompt } }));
const fs = vi.hoisted(() => ({ readFile: vi.fn(), writeFile: vi.fn().mockResolvedValue(undefined), mkdir: vi.fn().mockResolvedValue(undefined), access: vi.fn(), unlink: vi.fn().mockResolvedValue(undefined), appendFile: vi.fn().mockResolvedValue(undefined) }));
vi.mock('fs/promises', () => ({ default: fs }));
const https = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('https', () => ({ default: https }));
const vault = vi.hoisted(() => ({ isUnlocked: vi.fn(() => true), lock: vi.fn(), vaultExists: vi.fn(), unlock: vi.fn(), getVault2FAConfig: vi.fn(() => undefined), useBackupCode: vi.fn() }));
vi.mock('../src/storage/vault/index.js', () => vault);
const cryptoApi = vi.hoisted(() => ({ getIndexKey: vi.fn(() => Buffer.from('key')), encryptToPayload: vi.fn((s: string) => `enc:${s}`), decryptToString: vi.fn((s: string) => String(s).replace(/^enc:/, '')), initializeKeyManager: vi.fn() }));
vi.mock('../src/crypto/index.js', () => cryptoApi);
const argon = vi.hoisted(() => ({ argon2id: 2, hash: vi.fn(async (p: string) => `hash:${p}`), verify: vi.fn(async (h: string, p: string) => h === `hash:${p}`) }));
vi.mock('argon2', () => ({ default: argon }));
const sync = vi.hoisted(() => ({ uploadDuressHashToCloud: vi.fn().mockResolvedValue(true) }));
vi.mock('../src/storage/drive/synchronizer.js', () => sync);
const drive = vi.hoisted(() => ({ isAuthenticated: vi.fn(), authenticateDrive: vi.fn(), performOAuthFlow: vi.fn(), setGoogleOAuthCredentials: vi.fn(), isGoogleOAuthConfigured: vi.fn(), getCloudStorageMode: vi.fn(), isCloudStorageModeConfigured: vi.fn(), getPublicContentFolderName: vi.fn(), isPublicContentFolderNameConfigured: vi.fn(), setPublicContentFolderName: vi.fn(), setCloudStorageMode: vi.fn() }));
vi.mock('../src/storage/drive/index.js', () => drive);
vi.mock('../src/cli/commands/destruct.js', () => ({ destructCommand: vi.fn() }));
const spawn = vi.hoisted(() => vi.fn());
vi.mock('child_process', () => ({ spawn }));
const qr = vi.hoisted(() => ({ generate: vi.fn((_s: string, _o: unknown, cb: (s: string) => void) => cb('QR')) }));
vi.mock('qrcode-terminal', () => ({ default: qr }));
const ora = vi.hoisted(() => vi.fn(() => ({ start: vi.fn(() => ({ succeed: vi.fn(), fail: vi.fn(), stop: vi.fn() })) })));
vi.mock('ora', () => ({ default: ora }));
const otplib = vi.hoisted(() => ({ generate: vi.fn(async ({ secret }: { secret: string }) => { if (secret === '!') throw new Error('bad'); return '123456'; }), verify: vi.fn(async ({ token }: { token: string }) => token === '123456' ? 'valid' : 'invalid'), generateSecret: vi.fn(async () => 'JBSWY3DPEHPK3PXP'), generateURI: vi.fn() }));
vi.mock('otplib', () => otplib);
import * as prompts from '../src/cli/prompts.js';
import { promptCloudStorageMode, describeCloudStorageMode, promptPublicContentFolderName } from '../src/cli/cloudStorageSetup.js';
import { maskGoogleClientId, promptGoogleOAuthCredentials } from '../src/cli/googleOAuthSetup.js';
import * as fuzzy from '../src/cli/fuzzySearch.js';
import * as strength from '../src/cli/passwordStrength.js';
import { formatBytes, createProgressTracker, createMultiProgressBar, simulateProgress } from '../src/cli/progress.js';
import { openExternalUrl } from '../src/cli/openExternal.js';
import { checkPasswordBreach, checkMultipleBreaches, displayBreachResult, getBreachSeverity, getBreachDisplay, formatBreachCount } from '../src/cli/breachCheck.js';
import * as totp from '../src/cli/totp.js';
import * as themes from '../src/cli/themes.js';
import * as audit from '../src/cli/auditLog.js';
import * as auto from '../src/cli/autoLock.js';
import * as duress from '../src/cli/duress.js';
import { ensureAuthenticated } from '../src/cli/ensureAuth.js';
import * as twofa from '../src/cli/vault2fa.js';

beforeEach(() => { vi.restoreAllMocks(); prompt.mockReset(); fs.readFile.mockReset(); fs.access.mockReset(); fs.writeFile.mockClear(); fs.mkdir.mockClear(); fs.unlink.mockClear(); fs.appendFile.mockClear(); vault.isUnlocked.mockReturnValue(true); vault.lock.mockClear(); vault.vaultExists.mockReset(); drive.isAuthenticated.mockReset(); audit.resetAuditState(); duress.resetDuressState(); });

describe('prompts and setup prompts', () => {
  it('covers password, confirmation, entry, search, selection, carriers', async () => {
    prompt.mockResolvedValueOnce({ password: 'p' }); expect(await prompts.promptPassword()).toBe('p');
    expect(prompt.mock.calls[0][0][0].validate('')).toContain('required'); expect(prompt.mock.calls[0][0][0].validate('x')).toBe(true);
    prompt.mockResolvedValueOnce({ password: 'abcdefgh', confirm: 'abcdefgh' }); expect(await prompts.promptPasswordConfirm()).toBe('abcdefgh');
    prompt.mockResolvedValueOnce({ password: 'a', confirm: 'b' }); await expect(prompts.promptPasswordConfirm()).rejects.toThrow('do not match');
    prompt.mockResolvedValueOnce({ title: 'T', username: '' }).mockResolvedValueOnce({ action: 'manual' }).mockResolvedValueOnce({ password: '' }).mockResolvedValueOnce({ url: '', category: '', notes: ' n ' });
    expect(await prompts.promptEntryDetails()).toEqual({ title: 'T', username: undefined, password: undefined, url: undefined, category: undefined, notes: 'n' });
    prompt.mockResolvedValueOnce({ confirmed: true }).mockResolvedValueOnce({ query: 'q' }).mockResolvedValueOnce({ selected: '1' }).mockResolvedValueOnce({ pathsInput: 'a, b' });
    expect(await prompts.promptConfirm('x')).toBe(true); expect(await prompts.promptSearch()).toBe('q'); expect(await prompts.promptSelectEntry([])).toBeNull(); expect(await prompts.promptSelectEntry([{ id: '1', title: 'T', modified: 0 }])).toBe('1'); expect(await prompts.promptCarrierPaths()).toEqual(['a', 'b']);
  });
  it('covers storage and OAuth validators', async () => {
    prompt.mockResolvedValueOnce({ mode: 'hidden' }); expect(await promptCloudStorageMode()).toBe('hidden'); expect(describeCloudStorageMode('public')).toContain('Public'); expect(describeCloudStorageMode('hidden')).toContain('Hidden');
    prompt.mockResolvedValueOnce({ folderName: ' x ' }); expect(await promptPublicContentFolderName()).toBe('x'); const f = prompt.mock.calls.at(-1)![0][0]; expect(f.validate(' ')).toContain('required'); expect(f.validate('a/b')).toContain('cannot'); expect(f.validate('ok')).toBe(true);
    expect(maskGoogleClientId('short')).toBe('short'); expect(maskGoogleClientId('123456789012.apps.googleusercontent.com')).toContain('...'); prompt.mockResolvedValueOnce({ clientId: ' id.apps.googleusercontent.com ', clientSecret: ' secret123 ' }); expect(await promptGoogleOAuthCredentials()).toEqual({ clientId: 'id.apps.googleusercontent.com', clientSecret: 'secret123' }); const q = prompt.mock.calls.at(-1)![0]; expect(q[0].validate('')).toContain('required'); expect(q[0].validate('bad')).toContain('end'); expect(q[1].validate('short')).toContain('short');
  });
});

describe('breach checking', () => {
  it('checks breached, safe, cached, error and progress paths', async () => {
    const request = vi.fn((_: unknown, cb: (res: { statusCode: number; on: (event: string, fn: (chunk?: string) => void) => void }) => void) => {
      const res = { statusCode: 200, on: (event: string, fn: (chunk?: string) => void) => { if (event === 'data') fn('1E4C9B93F3F0682250B6CF8331B7EE68FD8:123'); if (event === 'end') fn(); } };
      cb(res); return { on: vi.fn(), setTimeout: vi.fn(), end: vi.fn(), destroy: vi.fn() };
    });
    https.request.mockImplementation(request);
    expect((await checkPasswordBreach('password')).breached).toBe(true);
    expect((await checkPasswordBreach('password')).count).toBe(123);
    expect(getBreachSeverity(0)).toBe('safe'); expect(getBreachSeverity(1)).toBe('low'); expect(getBreachSeverity(1000)).toBe('medium'); expect(getBreachSeverity(10000)).toBe('high'); expect(getBreachSeverity(100000)).toBe('critical');
    for (const n of [0, 1, 1000, 10000, 100000]) expect(getBreachDisplay(n).label).toBeDefined();
    expect(formatBreachCount(0)).toBe('No breaches'); expect(formatBreachCount(1000)).toContain('K'); expect(formatBreachCount(1000000)).toContain('M');
    const progress = vi.fn(); const results = await checkMultipleBreaches([{ id: '1', title: 'a', password: 'password' }], progress); expect(results.get('1')?.breached).toBe(true); expect(progress).toHaveBeenCalledWith(1, 1);
    vi.spyOn(console, 'log').mockImplementation(() => {}); displayBreachResult({ breached: false, count: 0 }); displayBreachResult({ breached: true, count: 2 }, 'title'); displayBreachResult({ breached: false, count: 0, error: 'network' });
  });
  it('returns network and non-200 errors', async () => {
    https.request.mockImplementation((_opts: unknown, cb: (res: { statusCode: number; on: (event: string, fn: () => void) => void }) => void) => { cb({ statusCode: 500, on: (_e, fn) => fn() }); return { on: vi.fn(), setTimeout: vi.fn(), end: vi.fn(), destroy: vi.fn() }; });
    expect((await checkPasswordBreach('different-password')).error).toContain('status 500');
  });
});

describe('fuzzy search, strength, progress and external opening', () => {
  const entries = [{ id: '1', title: 'Google', username: 'u', url: 'https://google.com', category: 'work', entryType: 'password', modified: 1, favorite: true }, { id: '2', title: 'Note', entryType: 'note', modified: 2, favorite: false }, { id: '3', title: 'File', entryType: 'file', modified: 3, favorite: false }];
  it('searches, highlights, formats and scores', () => { expect(fuzzy.fuzzySearchEntries(entries, ' ')).toHaveLength(3); expect(fuzzy.fuzzySearchEntries(entries, 'goog')[0]!.item.id).toBe('1'); expect(fuzzy.fuzzySearchEntries(entries, 'zzzzzzzzzz')).toEqual([]); expect(fuzzy.createEntrySearch(entries).search('google')).not.toHaveLength(0); expect(fuzzy.highlightMatches('abc', [])).toBe('abc'); expect(fuzzy.highlightMatches('abc', [[1, 1]])).toContain('b'); expect(fuzzy.formatSearchResult({ item: entries[0]!, score: 0, matches: [{ key: 'title', value: 'Google', indices: [[0, 2]] }] })).toContain('⭐'); expect(fuzzy.formatSearchResult({ item: entries[1]!, score: 0 })).toContain('📝'); expect(fuzzy.formatSearchResult({ item: entries[2]!, score: 0 })).toContain('📄'); expect(fuzzy.getMatchQuality(.2)).toBeTruthy(); expect(fuzzy.getMatchQuality(.5)).toBeTruthy(); expect(fuzzy.getMatchQuality(.8)).toBeTruthy(); });
  it('covers strength display and requirements', () => { expect(strength.analyzePasswordStrength('password').score).toBeDefined(); expect(strength.analyzePasswordStrength('X#9kL$mN2@pQ5rT8vW!yZ').score).toBeGreaterThan(2); for (const n of [0, 1, 2, 3, 4, 9]) { strength.getScoreColor(n)('x'); strength.getScoreBar(n); } vi.spyOn(console, 'log').mockImplementation(() => {}); strength.displayPasswordStrength('password', { title: 'x', showSuggestions: true }); expect(strength.meetsSecurityRequirements('x').meets).toBe(false); expect(strength.getStrengthSummary('password').label).toBeDefined(); });
  it('covers progress units and lifecycle', async () => { expect(formatBytes(1)).toBe('1 B'); expect(formatBytes(1024)).toContain('KB'); expect(formatBytes(1024 ** 2)).toContain('MB'); expect(formatBytes(1024 ** 3)).toContain('GB'); const t = createProgressTracker('Uploading', 100); t.update(10); t.update(200); t.setProgress(3, 50); t.setProgress(4, 0); t.finish(); createMultiProgressBar(); await simulateProgress('Encrypting', 10, async () => {}, 1); });
  it('validates URL and selects each platform launcher', async () => { await expect(openExternalUrl('javascript:x')).rejects.toThrow(); const child = { once: vi.fn((e: string, cb: (x?: Error) => void) => { if (e === 'spawn') cb(); }), unref: vi.fn() }; spawn.mockReturnValue(child); for (const [p, c] of [['linux', 'xdg-open'], ['darwin', 'open'], ['win32', 'rundll32.exe']] as const) { vi.spyOn(process, 'platform', 'get').mockReturnValue(p); await openExternalUrl('https://example.com'); expect(spawn).toHaveBeenLastCalledWith(c, expect.any(Array), expect.any(Object)); } });
});

describe('TOTP and themes', () => {
  it('covers TOTP validation, generation, parsing, URI and display', async () => { const s = 'JBSWY3DPEHPK3PXP'; expect(totp.validateTOTPSecret(s)).toBe(true); expect(totp.validateTOTPSecret('short')).toBe(false); expect(totp.cleanTOTPSecret(' jbsw ')).toBe('JBSW'); expect(await totp.generateTOTPCode(s)).toMatch(/^\d{6}$/); await expect(totp.generateTOTPCode('!')).rejects.toThrow('Invalid TOTP secret'); expect(totp.generateTOTPCodeSync(s)).toMatch(/^\d{6}$/); expect(() => totp.generateTOTPCodeSync('!')).toThrow(); expect(totp.parseOTPAuthURI('bad')).toBeNull(); expect(totp.parseOTPAuthURI('otpauth://hotp/x?secret=JBSWY3DPEHPK3PXP')).toBeNull(); expect(totp.parseOTPAuthURI('otpauth://totp/x?issuer=I')).toBeNull(); expect(totp.parseOTPAuthURI('otpauth://totp/x?secret=jbsw&algorithm=sha256&digits=8&period=60')).toMatchObject({ algorithm: 'SHA256', digits: 8, period: 60 }); expect(totp.generateOTPAuthURI('x', { secret: s, issuer: 'I', algorithm: 'SHA256', digits: 8, period: 60 })).toContain('digits=8'); totp.displayTOTPCode('123456', 'x'); expect(await totp.generateTOTPSecret()).toBeTruthy(); });
  it('loads, saves, changes and previews themes', async () => { fs.readFile.mockRejectedValueOnce(new Error()); await themes.loadTheme(); expect(themes.getCurrentTheme()).toBe('default'); expect(themes.getAvailableThemes()).toHaveLength(6); for (const n of themes.getAvailableThemes()) { expect(await themes.setTheme(n)).toBe(true); themes.previewTheme(n); } expect(await themes.setTheme('bad' as never)).toBe(false); expect(themes.getThemeColors().primary).toBeTruthy(); themes.showAllThemes(); });
});

describe('audit, auto lock, duress and vault 2FA', () => {
  afterEach(() => { vi.useRealTimers(); auto.stopAutoLockTimer(); });
  it('persists and displays audit entries, including locked and empty branches', async () => { fs.readFile.mockRejectedValueOnce(new Error()); await audit.logAuditEvent('failed_unlock_attempt', { details: 'bad', entryTitle: 'T' }); expect(await audit.getAuditEntries(1)).toHaveLength(1); vi.spyOn(console, 'log').mockImplementation(() => {}); vault.isUnlocked.mockReturnValue(false); await audit.displayAuditLog(); vault.isUnlocked.mockReturnValue(true); audit.resetAuditState(); fs.readFile.mockRejectedValueOnce(new Error()); await audit.displayAuditLog(); await audit.clearAuditLog(); });
  it('starts and stops auto lock and covers remaining formats', () => { vi.useFakeTimers(); vault.isUnlocked.mockReturnValue(true); auto.setAutoLockTimeout(1); auto.startAutoLockTimer(vi.fn()); expect(auto.getTimeRemaining()).not.toBeNull(); vi.advanceTimersByTime(60000); expect(vault.lock).toHaveBeenCalled(); auto.setAutoLockTimeout(0); expect(auto.formatTimeRemaining()).toContain('disabled'); auto.enableAutoLock(); auto.setAutoLockTimeout(2); expect(auto.formatTimeRemaining()).toMatch(/m|s/); auto.disableAutoLock(); });
  it('sets up, checks, activates and disables duress', async () => { fs.readFile.mockRejectedValue(new Error()); fs.access.mockResolvedValue(undefined); await duress.setupDuressPassword('duress-password', Buffer.from('key')); expect(await duress.checkDuressPasswordPreUnlock('duress-password')).toBe(false); duress.activateDuressModeSimple(); expect(duress.getDecoyEntries()).toHaveLength(2); duress.resetDuressState(); fs.readFile.mockResolvedValue('enc:{"enabled":true,"passwordHash":"hash:x","mode":"decoy","decoyEntries":[],"triggerCount":0}'); expect(await duress.checkDuressPassword('x', Buffer.from('key'))).toBe(true); await duress.activateDuressMode(Buffer.from('key')); await duress.disableDuressPassword(); });
  it('handles ensure auth duress and missing vault', async () => { duress.activateDuressModeSimple(); expect(await ensureAuthenticated()).toBe(true); duress.resetDuressState(); vault.vaultExists.mockResolvedValue(false); expect(await ensureAuthenticated()).toBe(false); });
  it('covers backup codes, TOTP checks, displays and setup cancellation', async () => { const secret = twofa.generateVault2FASecret(); expect(secret).toMatch(/^[A-Z2-7]+$/); const code = twofa.generateBackupCodes(1)[0]!; const h = twofa.hashBackupCode(code); expect(twofa.verifyBackupCode(code, [h])).toBe(0); expect(twofa.verifyBackupCode('wrong', [h])).toBe(-1); expect(typeof twofa.verifyVault2FACode('123456', secret)).toBe('boolean'); expect(twofa.verifyVault2FACode('bad', 'secret')).toBe(false); expect(twofa.formatSecretForDisplay('ABCDEFGHI')).toBe('ABCD EFGH I'); expect(twofa.generateTextQRCode('x')).toContain("Can't scan"); vi.spyOn(console, 'log').mockImplementation(() => {}); twofa.displaySetupInstructions(secret); twofa.displayBackupCodes([code]); twofa.showVault2FAHelp(); const save = vi.fn(); prompt.mockResolvedValueOnce({ proceed: false }); await twofa.interactiveSetup2FA(undefined, save); expect(save).not.toHaveBeenCalled(); });
});
