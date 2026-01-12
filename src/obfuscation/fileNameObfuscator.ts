import { randomInt, randomHex } from '../crypto/index.js';

/**
 * Generate an obfuscated filename that looks like a normal photo
 */
export function generateFilename(extension: string = 'png'): string {
  const patterns = [
    () => generateCameraPattern(extension),
    () => generateScreenshotPattern(extension),
    () => generatePhotoPattern(extension),
    () => generateDocumentPattern(extension),
  ];

  const pattern = patterns[randomInt(0, patterns.length - 1)]!;
  return pattern();
}

/**
 * Camera-style filename: IMG_YYYYMMDD_HHMMSS_XXXX.ext
 */
function generateCameraPattern(ext: string): string {
  const now = new Date();
  // Randomize date within last 2 years
  const daysAgo = randomInt(0, 730);
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(randomInt(0, 23)).padStart(2, '0');
  const minutes = String(randomInt(0, 59)).padStart(2, '0');
  const seconds = String(randomInt(0, 59)).padStart(2, '0');
  const suffix = randomHex(2);

  return `IMG_${year}${month}${day}_${hours}${minutes}${seconds}_${suffix}.${ext}`;
}

/**
 * Screenshot-style filename: Screenshot_YYYY-MM-DD_HH-MM-SS.ext
 */
function generateScreenshotPattern(ext: string): string {
  const now = new Date();
  const daysAgo = randomInt(0, 365);
  const date = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(randomInt(0, 23)).padStart(2, '0');
  const minutes = String(randomInt(0, 59)).padStart(2, '0');
  const seconds = String(randomInt(0, 59)).padStart(2, '0');

  return `Screenshot_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.${ext}`;
}

/**
 * Photo-style filename: photo_XXXX.ext or DSC_XXXX.ext
 */
function generatePhotoPattern(ext: string): string {
  const prefixes = ['photo', 'DSC', 'DCIM', 'PXL', 'P'];
  const prefix = prefixes[randomInt(0, prefixes.length - 1)];
  const number = String(randomInt(1000, 9999));
  const suffix = randomInt(0, 1) ? `_${randomHex(2)}` : '';

  return `${prefix}_${number}${suffix}.${ext}`;
}

/**
 * Document-style filename: Document_UUID.ext
 */
function generateDocumentPattern(ext: string): string {
  const prefixes = ['Document', 'Scan', 'File', 'Image'];
  const prefix = prefixes[randomInt(0, prefixes.length - 1)];
  const id = randomHex(4);

  return `${prefix}_${id}.${ext}`;
}

/**
 * Generate a random timestamp for file metadata (within last 2 years)
 */
export function generateRandomTimestamp(): Date {
  const now = Date.now();
  const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;
  const randomMs = randomInt(0, twoYearsMs);
  return new Date(now - randomMs);
}

/**
 * Generate decoy filename that's clearly not a data file
 */
export function generateDecoyFilename(extension: string = 'png'): string {
  const decoyPatterns = [
    () => `vacation_${randomInt(2020, 2025)}_${randomHex(2)}.${extension}`,
    () => `family_photo_${randomHex(4)}.${extension}`,
    () => `sunset_${randomHex(3)}.${extension}`,
    () => `birthday_${randomInt(2020, 2025)}.${extension}`,
    () => `landscape_${randomHex(4)}.${extension}`,
    () => `selfie_${randomHex(3)}.${extension}`,
  ];

  const pattern = decoyPatterns[randomInt(0, decoyPatterns.length - 1)]!;
  return pattern();
}
