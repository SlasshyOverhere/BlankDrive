import fs from 'fs/promises';
import { PNG } from 'pngjs';
import { calculateChecksum, verifyChecksum } from '../crypto/index.js';

// Magic bytes to identify steganographic content
const MAGIC_BYTES = Buffer.from([0x53, 0x4C, 0x53, 0x48]); // "SLSH"
const HEADER_SIZE = 16; // Magic(4) + Length(4) + Checksum(8)

export interface EmbedResult {
  outputPath: string;
  bytesEmbedded: number;
  capacity: number;
  checksum: string;
}

export interface ExtractResult {
  data: Buffer;
  checksum: string;
}

/**
 * Calculate the steganographic capacity of a PNG image
 * Using LSB of RGB channels (1 bit per channel = 3 bits per pixel)
 */
export function calculateCapacity(width: number, height: number): number {
  // Each pixel has RGB (3 channels), each can store 1 bit
  // So 3 bits per pixel = 3/8 bytes per pixel
  const totalBits = width * height * 3;
  const totalBytes = Math.floor(totalBits / 8);
  // Reserve space for header
  return totalBytes - HEADER_SIZE;
}

/**
 * Load a PNG image from file
 */
export async function loadPNG(imagePath: string): Promise<PNG> {
  const buffer = await fs.readFile(imagePath);
  return new Promise((resolve, reject) => {
    new PNG().parse(buffer, (error: Error | null, png: PNG) => {
      if (error) reject(error);
      else resolve(png);
    });
  });
}

/**
 * Save a PNG image to file
 */
export async function savePNG(png: PNG, outputPath: string): Promise<void> {
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
 * Convert buffer to bit array
 */
function bufferToBits(buffer: Buffer): number[] {
  const bits: number[] = [];
  for (const byte of buffer) {
    for (let i = 7; i >= 0; i--) {
      bits.push((byte >> i) & 1);
    }
  }
  return bits;
}

/**
 * Convert bit array to buffer
 */
function bitsToBuffer(bits: number[]): Buffer {
  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8 && i + j < bits.length; j++) {
      byte = (byte << 1) | (bits[i + j] ?? 0);
    }
    bytes.push(byte);
  }
  return Buffer.from(bytes);
}

/**
 * Create header for embedded data
 */
function createHeader(dataLength: number, checksum: string): Buffer {
  const header = Buffer.alloc(HEADER_SIZE);

  // Magic bytes (4)
  MAGIC_BYTES.copy(header, 0);

  // Data length as uint32 big-endian (4)
  header.writeUInt32BE(dataLength, 4);

  // Checksum (8 bytes from hex string)
  Buffer.from(checksum, 'hex').copy(header, 8);

  return header;
}

/**
 * Parse header from extracted data
 */
function parseHeader(header: Buffer): { length: number; checksum: string } | null {
  // Verify magic bytes
  if (!header.subarray(0, 4).equals(MAGIC_BYTES)) {
    return null;
  }

  const length = header.readUInt32BE(4);
  const checksum = header.subarray(8, 16).toString('hex');

  return { length, checksum };
}

/**
 * Embed encrypted data into a PNG image using LSB steganography
 */
export async function embedInPNG(
  carrierPath: string,
  data: Buffer,
  outputPath: string
): Promise<EmbedResult> {
  const png = await loadPNG(carrierPath);
  const capacity = calculateCapacity(png.width, png.height);

  if (data.length > capacity) {
    throw new Error(
      `Data too large for carrier. Data: ${data.length} bytes, Capacity: ${capacity} bytes`
    );
  }

  const checksum = calculateChecksum(data);
  const header = createHeader(data.length, checksum);
  const payload = Buffer.concat([header, data]);
  const bits = bufferToBits(payload);

  let bitIndex = 0;

  // Embed bits into LSB of RGB channels
  for (let y = 0; y < png.height && bitIndex < bits.length; y++) {
    for (let x = 0; x < png.width && bitIndex < bits.length; x++) {
      const idx = (png.width * y + x) * 4; // RGBA

      // Modify R channel LSB
      if (bitIndex < bits.length) {
        png.data[idx] = (png.data[idx]! & 0xFE) | bits[bitIndex]!;
        bitIndex++;
      }

      // Modify G channel LSB
      if (bitIndex < bits.length) {
        png.data[idx + 1] = (png.data[idx + 1]! & 0xFE) | bits[bitIndex]!;
        bitIndex++;
      }

      // Modify B channel LSB
      if (bitIndex < bits.length) {
        png.data[idx + 2] = (png.data[idx + 2]! & 0xFE) | bits[bitIndex]!;
        bitIndex++;
      }

      // Alpha channel is not modified (would be noticeable)
    }
  }

  await savePNG(png, outputPath);

  return {
    outputPath,
    bytesEmbedded: data.length,
    capacity,
    checksum,
  };
}

/**
 * Extract hidden data from a PNG image
 */
export async function extractFromPNG(imagePath: string): Promise<ExtractResult> {
  const png = await loadPNG(imagePath);

  // Extract all LSB bits
  const bits: number[] = [];
  const maxBits = png.width * png.height * 3;

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) * 4;

      // Extract R channel LSB
      bits.push(png.data[idx]! & 1);

      // Extract G channel LSB
      bits.push(png.data[idx + 1]! & 1);

      // Extract B channel LSB
      bits.push(png.data[idx + 2]! & 1);

      // Stop if we have enough bits for header
      if (bits.length >= HEADER_SIZE * 8) {
        // Parse header to get actual data length
        const headerBits = bits.slice(0, HEADER_SIZE * 8);
        const headerBuffer = bitsToBuffer(headerBits);
        const headerInfo = parseHeader(headerBuffer);

        if (headerInfo) {
          const totalBitsNeeded = (HEADER_SIZE + headerInfo.length) * 8;
          if (bits.length >= totalBitsNeeded) {
            // Extract data
            const dataBits = bits.slice(HEADER_SIZE * 8, totalBitsNeeded);
            const data = bitsToBuffer(dataBits);

            // Verify checksum
            if (!verifyChecksum(data, headerInfo.checksum)) {
              throw new Error('Data integrity check failed: checksum mismatch');
            }

            return {
              data,
              checksum: headerInfo.checksum,
            };
          }
        }
      }
    }
  }

  // Full extraction if header wasn't found early
  const allData = bitsToBuffer(bits);
  const headerInfo = parseHeader(allData.subarray(0, HEADER_SIZE));

  if (!headerInfo) {
    throw new Error('No hidden data found in image');
  }

  const data = allData.subarray(HEADER_SIZE, HEADER_SIZE + headerInfo.length);

  if (!verifyChecksum(data, headerInfo.checksum)) {
    throw new Error('Data integrity check failed: checksum mismatch');
  }

  return {
    data,
    checksum: headerInfo.checksum,
  };
}

/**
 * Check if an image has embedded data
 */
export async function hasEmbeddedData(imagePath: string): Promise<boolean> {
  try {
    const png = await loadPNG(imagePath);

    // Extract just enough bits for magic bytes
    const bits: number[] = [];

    outer: for (let y = 0; y < png.height; y++) {
      for (let x = 0; x < png.width; x++) {
        const idx = (png.width * y + x) * 4;
        bits.push(png.data[idx]! & 1);
        bits.push(png.data[idx + 1]! & 1);
        bits.push(png.data[idx + 2]! & 1);

        if (bits.length >= 32) break outer; // 4 bytes = 32 bits
      }
    }

    const magicBuffer = bitsToBuffer(bits.slice(0, 32));
    return magicBuffer.equals(MAGIC_BYTES);
  } catch {
    return false;
  }
}

/**
 * Get image info for capacity calculation
 */
export async function getImageInfo(imagePath: string): Promise<{
  width: number;
  height: number;
  capacity: number;
}> {
  const png = await loadPNG(imagePath);
  return {
    width: png.width,
    height: png.height,
    capacity: calculateCapacity(png.width, png.height),
  };
}
