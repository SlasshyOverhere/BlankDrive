import argon2 from 'argon2';
import crypto from 'crypto';
import { generateSalt } from './random.js';
import { wipeBuffer } from './memoryGuard.js';
import type { DerivedKeys, KdfParams } from '../types/index.js';
import { DEFAULT_KDF_PARAMS } from '../types/index.js';

/**
 * Derive master key from password using Argon2id
 */
export async function deriveKey(
  password: string,
  salt: Buffer,
  params: KdfParams = DEFAULT_KDF_PARAMS
): Promise<Buffer> {
  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    salt,
    timeCost: params.timeCost,
    memoryCost: params.memoryCost,
    parallelism: params.parallelism,
    hashLength: params.hashLength,
    raw: true,
  });

  return hash;
}

/**
 * Derive sub-keys from master key using HKDF
 */
export function deriveSubKey(
  masterKey: Buffer,
  context: string,
  length: number = 32
): Buffer {
  const derived = crypto.hkdfSync(
    'sha256',
    masterKey,
    Buffer.alloc(0), // No salt for HKDF (already salted in Argon2)
    Buffer.from(context, 'utf-8'),
    length
  );
  return Buffer.from(derived);
}

/**
 * Derive all necessary keys from master password
 */
export async function deriveAllKeys(
  password: string,
  salt?: Buffer
): Promise<{ keys: DerivedKeys; salt: Buffer }> {
  const actualSalt = salt || generateSalt(32);

  const masterKey = await deriveKey(password, actualSalt);

  const keys: DerivedKeys = {
    masterKey,
    indexKey: deriveSubKey(masterKey, 'slasshy-index-key'),
    entryKey: deriveSubKey(masterKey, 'slasshy-entry-key'),
    metadataKey: deriveSubKey(masterKey, 'slasshy-metadata-key'),
  };

  return { keys, salt: actualSalt };
}

/**
 * Verify password against stored salt
 */
export async function verifyPassword(
  password: string,
  salt: Buffer,
  expectedKeyHash: Buffer
): Promise<boolean> {
  const masterKey = await deriveKey(password, salt);
  const keyHash = crypto.createHash('sha256').update(masterKey).digest();

  const isValid = crypto.timingSafeEqual(keyHash, expectedKeyHash);

  wipeBuffer(masterKey);

  return isValid;
}

/**
 * Create a hash of the master key for verification
 */
export function hashKey(key: Buffer): Buffer {
  return crypto.createHash('sha256').update(key).digest();
}
