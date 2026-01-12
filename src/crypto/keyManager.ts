import { SecureKeyHolder, wipeBuffer, setupSecureCleanup } from './memoryGuard.js';
import { deriveAllKeys, hashKey } from './kdf.js';
import type { DerivedKeys } from '../types/index.js';

// Global key holders
const masterKeyHolder = new SecureKeyHolder();
const indexKeyHolder = new SecureKeyHolder();
const entryKeyHolder = new SecureKeyHolder();
const metadataKeyHolder = new SecureKeyHolder();

let currentSalt: Buffer | null = null;
let keyHash: Buffer | null = null;

/**
 * Initialize the key manager with cleanup handlers
 */
export function initializeKeyManager(): void {
  setupSecureCleanup();
}

/**
 * Unlock the vault with password
 */
export async function unlockVault(
  password: string,
  salt: Buffer
): Promise<void> {
  const { keys } = await deriveAllKeys(password, salt);

  masterKeyHolder.setKey(keys.masterKey);
  indexKeyHolder.setKey(keys.indexKey);
  entryKeyHolder.setKey(keys.entryKey);
  metadataKeyHolder.setKey(keys.metadataKey);

  currentSalt = Buffer.from(salt);
  keyHash = hashKey(keys.masterKey);

  // Wipe the original keys (copies are held)
  wipeBuffer(keys.masterKey);
  wipeBuffer(keys.indexKey);
  wipeBuffer(keys.entryKey);
  wipeBuffer(keys.metadataKey);
}

/**
 * Create new vault with password
 */
export async function createVault(
  password: string
): Promise<{ salt: Buffer; keyHash: Buffer }> {
  const { keys, salt } = await deriveAllKeys(password);

  masterKeyHolder.setKey(keys.masterKey);
  indexKeyHolder.setKey(keys.indexKey);
  entryKeyHolder.setKey(keys.entryKey);
  metadataKeyHolder.setKey(keys.metadataKey);

  currentSalt = Buffer.from(salt);
  keyHash = hashKey(keys.masterKey);

  const result = {
    salt: Buffer.from(salt),
    keyHash: Buffer.from(keyHash),
  };

  // Wipe the original keys
  wipeBuffer(keys.masterKey);
  wipeBuffer(keys.indexKey);
  wipeBuffer(keys.entryKey);
  wipeBuffer(keys.metadataKey);

  return result;
}

/**
 * Lock the vault (clear all keys)
 */
export function lockVault(): void {
  masterKeyHolder.clear();
  indexKeyHolder.clear();
  entryKeyHolder.clear();
  metadataKeyHolder.clear();

  if (currentSalt) {
    wipeBuffer(currentSalt);
    currentSalt = null;
  }
  if (keyHash) {
    wipeBuffer(keyHash);
    keyHash = null;
  }
}

/**
 * Check if vault is unlocked
 */
export function isVaultUnlocked(): boolean {
  return masterKeyHolder.hasKey();
}

/**
 * Get the index encryption key
 */
export function getIndexKey(): Buffer {
  const key = indexKeyHolder.getKey();
  if (!key) {
    throw new Error('Vault is locked. Please unlock first.');
  }
  return key;
}

/**
 * Get the entry encryption key
 */
export function getEntryKey(): Buffer {
  const key = entryKeyHolder.getKey();
  if (!key) {
    throw new Error('Vault is locked. Please unlock first.');
  }
  return key;
}

/**
 * Get the metadata encryption key
 */
export function getMetadataKey(): Buffer {
  const key = metadataKeyHolder.getKey();
  if (!key) {
    throw new Error('Vault is locked. Please unlock first.');
  }
  return key;
}

/**
 * Get current salt
 */
export function getCurrentSalt(): Buffer | null {
  return currentSalt;
}

/**
 * Get key hash for verification
 */
export function getKeyHash(): Buffer | null {
  return keyHash;
}
