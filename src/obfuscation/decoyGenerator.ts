import fs from 'fs/promises';
import path from 'path';
import { PNG } from 'pngjs';
import { randomInt, randomBytes } from '../crypto/index.js';
import { generateDecoyFilename } from './fileNameObfuscator.js';

/**
 * Generate a simple procedural PNG image for decoy purposes
 */
export async function generateDecoyImage(
  outputPath: string,
  width: number = 800,
  height: number = 600
): Promise<void> {
  const png = new PNG({ width, height });

  // Generate a simple gradient or noise pattern
  const pattern = randomInt(0, 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) * 4;

      let r: number, g: number, b: number;

      switch (pattern) {
        case 0:
          // Gradient
          r = Math.floor((x / width) * 200) + 55;
          g = Math.floor((y / height) * 200) + 55;
          b = Math.floor(((x + y) / (width + height)) * 200) + 55;
          break;
        case 1:
          // Noise
          r = randomInt(100, 255);
          g = randomInt(100, 255);
          b = randomInt(100, 255);
          break;
        default:
          // Solid color with slight variation
          const baseColor = randomBytes(3);
          r = (baseColor[0]! + randomInt(-10, 10) + 256) % 256;
          g = (baseColor[1]! + randomInt(-10, 10) + 256) % 256;
          b = (baseColor[2]! + randomInt(-10, 10) + 256) % 256;
      }

      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255; // Alpha
    }
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    png.pack()
      .on('data', (chunk: Buffer) => chunks.push(chunk))
      .on('end', async () => {
        await fs.writeFile(outputPath, Buffer.concat(chunks));
        resolve();
      })
      .on('error', reject);
  });
}

/**
 * Generate multiple decoy files
 */
export async function generateDecoys(
  outputDir: string,
  count: number,
  extension: string = 'png'
): Promise<string[]> {
  const createdFiles: string[] = [];

  for (let i = 0; i < count; i++) {
    const filename = generateDecoyFilename(extension);
    const outputPath = path.join(outputDir, filename);

    // Random dimensions
    const width = randomInt(640, 1920);
    const height = randomInt(480, 1080);

    await generateDecoyImage(outputPath, width, height);
    createdFiles.push(outputPath);
  }

  return createdFiles;
}

/**
 * Check if a file is a decoy (no embedded data)
 */
export async function isDecoy(filePath: string): Promise<boolean> {
  // Import dynamically to avoid circular dependency
  const { hasEmbeddedData } = await import('../steganography/png-stego.js');
  return !(await hasEmbeddedData(filePath));
}

/**
 * Generate decoys based on ratio to real files
 */
export async function generateDecoysByRatio(
  outputDir: string,
  realFileCount: number,
  ratio: number = 2 // 2 decoys per real file
): Promise<string[]> {
  const decoyCount = Math.ceil(realFileCount * ratio);
  return generateDecoys(outputDir, decoyCount);
}
