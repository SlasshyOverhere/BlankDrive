import crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as encryption from '../src/crypto/encryption.js';
import * as kdf from '../src/crypto/kdf.js';
import * as memory from '../src/crypto/memoryGuard.js';
import * as random from '../src/crypto/random.js';
import * as passwords from '../src/crypto/passwordGenerator.js';
import * as manager from '../src/crypto/keyManager.js';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); manager.lockVault(); });

describe('crypto encryption', () => {
  const key = Buffer.alloc(32, 7);
  it('round trips all public representations and AAD', () => {
    const raw = Buffer.from('secret');
    const enc = encryption.encrypt(raw, key, Buffer.from('aad'));
    expect(enc.iv).toHaveLength(12); expect(enc.authTag).toHaveLength(16);
    expect(encryption.decrypt(enc, key, Buffer.from('aad'))).toEqual(raw);
    const buf = encryption.encryptToBuffer('text', key, 'ctx');
    expect(encryption.decryptFromBuffer(buf, key, 'ctx').toString()).toBe('text');
    const payload = encryption.encryptToPayload(Buffer.from('bytes'), key);
    expect(encryption.decryptFromPayload(payload, key)).toEqual(Buffer.from('bytes'));
    expect(encryption.decryptToString(encryption.encryptToPayload('str', key), key)).toBe('str');
    const obj = encryption.encryptObject({ n: 1 }, key, 'obj');
    expect(encryption.decryptObject<{ n: number }>(obj, key, 'obj')).toEqual({ n: 1 });
    expect(encryption.decrypt(encryption.encrypt(Buffer.alloc(0), key), key)).toEqual(Buffer.alloc(0));
  });
  it('rejects short, tampered, wrong-key and wrong-AAD input', () => {
    expect(() => encryption.decryptFromBuffer(Buffer.alloc(27), key)).toThrow('too short');
    const enc = encryption.encrypt(Buffer.from('x'), key, Buffer.from('a'));
    const bad = { ...enc, ciphertext: Buffer.from(enc.ciphertext) }; bad.ciphertext[0] = bad.ciphertext[0]! ^ 1;
    expect(() => encryption.decrypt(bad, key, Buffer.from('a'))).toThrow('Decryption failed');
    expect(() => encryption.decrypt(enc, Buffer.alloc(32, 8), Buffer.from('a'))).toThrow('Decryption failed');
    expect(() => encryption.decrypt(enc, key, Buffer.from('b'))).toThrow('Decryption failed');
  });
});

describe('crypto derivation and random', () => {
  it('derives keys, verifies passwords, and hashes with contexts', async () => {
    const salt = Buffer.alloc(32, 3);
    const key = await kdf.deriveKey('pw', salt, { timeCost: 1, memoryCost: 1024, parallelism: 1, hashLength: 16 });
    expect(key).toHaveLength(16); expect(kdf.deriveSubKey(key, 'c', 17)).toHaveLength(17);
    const all = await kdf.deriveAllKeys('pw', salt); expect(all.salt).toEqual(salt);
    expect(all.keys.masterKey).toHaveLength(32); expect(kdf.hashKey(key, 'a')).not.toEqual(kdf.hashKey(key, 'b'));
    const hash = kdf.hashKey(await kdf.deriveKey('pw', salt), 'ctx');
    expect(await kdf.verifyPassword('pw', salt, hash, 'ctx')).toBe(true);
    expect(await kdf.verifyPassword('bad', salt, hash, 'ctx')).toBe(false);
    expect(await kdf.verifyPassword('pw', salt, hash, 'other')).toBe(false);
  });
  it('covers random and checksum helpers', () => {
    expect(random.randomBytes(2)).toHaveLength(2); expect(random.generateSalt(3)).toHaveLength(3); expect(random.generateIV()).toHaveLength(12);
    expect(random.generateUUID()).toMatch(/^[0-9a-f-]{36}$/); expect(random.randomInt(4, 4)).toBe(4); expect(random.randomHex(2)).toHaveLength(4);
    expect(random.sha256('x')).toEqual(crypto.createHash('sha256').update('x').digest());
    const d = Buffer.from('data'); const c = random.calculateChecksum(d); expect(c).toHaveLength(16); expect(random.verifyChecksum(d, c)).toBe(true); expect(random.verifyChecksum(Buffer.from('x'), c)).toBe(false);
  });
});

describe('memory guards', () => {
  it('protects and wipes strings, buffers, and holders', () => {
    const s = new memory.SecureString('secret'); expect(s.getString()).toBe('secret'); expect(s.getBuffer()).toEqual(Buffer.from('secret')); s[Symbol.dispose](); expect(s.isWiped()).toBe(true); expect(() => s.getString()).toThrow('wiped'); expect(() => s.getBuffer()).toThrow('wiped');
    const b = memory.createSecureBuffer(3); b.fill(1); memory.wipeAllSecureBuffers(); expect(b).toEqual(Buffer.alloc(3)); const x = Buffer.alloc(1, 1); memory.wipeBuffer(x); expect(x).toEqual(Buffer.alloc(1)); memory.wipeBuffer(Buffer.alloc(0)); memory.wipeString('x');
    expect(memory.secureCompare(Buffer.from('a'), Buffer.from('a'))).toBe(true); expect(memory.secureCompare(Buffer.from('a'), Buffer.from('b'))).toBe(false); expect(memory.secureCompare(Buffer.from('a'), Buffer.from('aa'))).toBe(false);
    vi.useFakeTimers(); const h = new memory.SecureKeyHolder(10); expect(h.getKey()).toBeNull(); h.setKey(Buffer.from('k')); expect(h.hasKey()).toBe(true); h.getKey(); vi.advanceTimersByTime(11); expect(h.hasKey()).toBe(false); h.setKey(Buffer.from('x')); h.clear(); expect(h.getKey()).toBeNull();
  });
});

describe('password generator', () => {
  it('generates constrained passwords and validates options', () => {
    expect(passwords.generatePassword({ length: 20 })).toHaveLength(20); expect(passwords.generatePassword({ length: 8, uppercase: false, lowercase: false, symbols: false, excludeAmbiguous: false })).toMatch(/^\d+$/);
    expect(() => passwords.generatePassword({ length: 3 })).toThrow('at least 4'); expect(() => passwords.generatePassword({ length: 257 })).toThrow('exceed 256'); expect(() => passwords.generatePassword({ length: 4, uppercase: false, lowercase: false, numbers: false, customSymbols: '*', excludeChars: '*' })).toThrow('empty');
    const spy = vi.spyOn(crypto, 'randomBytes').mockImplementation((n: number) => Buffer.alloc(n)); const p = passwords.generatePassword({ length: 12, excludeAmbiguous: false }); expect(p).toMatch(/[A-Z]/); expect(p).toMatch(/[a-z]/); expect(p).toMatch(/\d/); expect(p).toMatch(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/); spy.mockRestore();
    expect(passwords.PASSWORD_PRESETS.pin.length).toBe(6);
  });
  it('analyzes entropy, penalties, strength, and passphrases', () => {
    expect(passwords.calculateEntropy('')).toBe(0); expect(passwords.calculateEntropy('abc')).toBeGreaterThan(0);
    expect(passwords.analyzePassword('123').feedback).toEqual(expect.arrayContaining(['Password is too short (min 8 characters)', 'Avoid using only numbers', 'Avoid common patterns'])); expect(passwords.analyzePassword('abcdefgh').feedback).toContain('Avoid using only letters'); expect(passwords.analyzePassword('aaaabbbb').feedback).toContain('Avoid repeated characters'); expect(['strong', 'excellent']).toContain(passwords.analyzePassword('aB7!'.repeat(8)).strength);
    expect(passwords.generatePassphrase(3, '_')).toMatch(/^[A-Z][a-z]+_[A-Z][a-z]+_[A-Z][a-z]+_\d+$/); expect(() => passwords.generatePassphrase(2)).toThrow('at least 3'); expect(() => passwords.generatePassphrase(13)).toThrow('exceed 12');
  });
});

describe('key manager', () => {
  it('runs the lock/create/unlock lifecycle', async () => {
    manager.initializeKeyManager(); expect(manager.isVaultUnlocked()).toBe(false); expect(() => manager.getIndexKey()).toThrow('locked'); expect(() => manager.getEntryKey()).toThrow('locked'); expect(() => manager.getMetadataKey()).toThrow('locked');
    const made = await manager.createVault('pw'); expect(made.salt).toHaveLength(32); expect(made.keyHash).toHaveLength(32); expect(manager.isVaultUnlocked()).toBe(true); expect(manager.getCurrentSalt()).toEqual(made.salt); expect(manager.getKeyHash()).toEqual(made.keyHash); expect(manager.getIndexKey()).toHaveLength(32); expect(manager.getEntryKey()).toHaveLength(32); expect(manager.getMetadataKey()).toHaveLength(32);
    const salt = Buffer.alloc(32, 9); await manager.unlockVault('pw', salt); expect(manager.getCurrentSalt()).toEqual(salt); manager.lockVault(); expect(manager.isVaultUnlocked()).toBe(false); expect(manager.getCurrentSalt()).toBeNull(); expect(manager.getKeyHash()).toBeNull();
  });
});
