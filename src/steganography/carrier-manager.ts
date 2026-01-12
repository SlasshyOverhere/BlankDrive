import fs from 'fs/promises';
import path from 'path';
import { getImageInfo } from './png-stego.js';

export interface CarrierFile {
  path: string;
  capacity: number;
  width: number;
  height: number;
}

/**
 * Scan a directory for suitable carrier images
 */
export async function scanForCarriers(
  directory: string,
  minCapacity: number = 1024 // Minimum 1KB capacity
): Promise<CarrierFile[]> {
  const carriers: CarrierFile[] = [];

  try {
    const files = await fs.readdir(directory);

    for (const file of files) {
      const filePath = path.join(directory, file);
      const ext = path.extname(file).toLowerCase();

      if (ext === '.png') {
        try {
          const info = await getImageInfo(filePath);
          if (info.capacity >= minCapacity) {
            carriers.push({
              path: filePath,
              ...info,
            });
          }
        } catch {
          // Skip files that can't be parsed
        }
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  // Sort by capacity (largest first)
  return carriers.sort((a, b) => b.capacity - a.capacity);
}

/**
 * Find best carrier for given data size
 */
export function findBestCarrier(
  carriers: CarrierFile[],
  dataSize: number
): CarrierFile | null {
  // Find smallest carrier that can fit the data
  const suitable = carriers
    .filter(c => c.capacity >= dataSize)
    .sort((a, b) => a.capacity - b.capacity);

  return suitable[0] || null;
}

/**
 * Get total available capacity from carriers
 */
export function getTotalCapacity(carriers: CarrierFile[]): number {
  return carriers.reduce((sum, c) => sum + c.capacity, 0);
}

/**
 * Copy carrier to output location with new name
 */
export async function copyCarrier(
  sourcePath: string,
  destPath: string
): Promise<void> {
  await fs.copyFile(sourcePath, destPath);
}

/**
 * Validate that a file is a valid PNG carrier
 */
export async function validateCarrier(filePath: string): Promise<boolean> {
  try {
    const info = await getImageInfo(filePath);
    return info.capacity > 0;
  } catch {
    return false;
  }
}
