import crypto from 'crypto';

/**
 * Generate cryptographically secure random bytes
 */
export function randomBytes(size: number): Buffer {
  return crypto.randomBytes(size);
}

/**
 * Generate a random salt for key derivation
 */
export function generateSalt(size: number = 32): Buffer {
  return randomBytes(size);
}

/**
 * Generate a random IV for AES-GCM (12 bytes recommended)
 */
export function generateIV(): Buffer {
  return randomBytes(12);
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Generate a random integer between min and max (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return crypto.randomInt(min, max + 1);
}

/**
 * Generate a random hex string
 */
export function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Calculate SHA-256 hash
 */
export function sha256(data: Buffer | string): Buffer {
  return crypto.createHash('sha256').update(data).digest();
}

/**
 * Calculate checksum for data integrity
 */
export function calculateChecksum(data: Buffer): string {
  return sha256(data).subarray(0, 8).toString('hex');
}

/**
 * Verify checksum
 */
export function verifyChecksum(data: Buffer, checksum: string): boolean {
  return calculateChecksum(data) === checksum;
}
