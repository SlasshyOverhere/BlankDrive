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

// bufferToBits removed
// bitsToBuffer removed

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

  const payloadBits = payload.length * 8;
  let bitIndex = 0;

  // Embed bits into LSB of RGB channels
  for (let y = 0; y < png.height && bitIndex < payloadBits; y++) {
    for (let x = 0; x < png.width && bitIndex < payloadBits; x++) {
      const idx = (png.width * y + x) * 4; // RGBA

      // Modify R channel LSB
      if (bitIndex < payloadBits) {
        const byteIndex = Math.floor(bitIndex / 8);
        const bitOffset = 7 - (bitIndex % 8);
        const bit = (payload[byteIndex]! >> bitOffset) & 1;
        png.data[idx] = (png.data[idx]! & 0xFE) | bit;
        bitIndex++;
      }

      // Modify G channel LSB
      if (bitIndex < payloadBits) {
        const byteIndex = Math.floor(bitIndex / 8);
        const bitOffset = 7 - (bitIndex % 8);
        const bit = (payload[byteIndex]! >> bitOffset) & 1;
        png.data[idx + 1] = (png.data[idx + 1]! & 0xFE) | bit;
        bitIndex++;
      }

      // Modify B channel LSB
      if (bitIndex < payloadBits) {
        const byteIndex = Math.floor(bitIndex / 8);
        const bitOffset = 7 - (bitIndex % 8);
        const bit = (payload[byteIndex]! >> bitOffset) & 1;
        png.data[idx + 2] = (png.data[idx + 2]! & 0xFE) | bit;
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

  // Buffer to store extracted bits (accumulating bytes)
  // We don't know the full size yet, but we need at least the header
  let extractedBuffer = Buffer.alloc(HEADER_SIZE);
  let bitIndex = 0;
  let headerParsed = false;
  let totalBytesNeeded = HEADER_SIZE;
  let headerInfo: { length: number; checksum: string } | null = null;

  const processBit = (bit: number) => {
    const byteIndex = Math.floor(bitIndex / 8);
    const bitOffset = 7 - (bitIndex % 8);

    // Resize buffer if needed
    if (byteIndex >= extractedBuffer.length) {
      const newSize = headerParsed ? totalBytesNeeded : extractedBuffer.length * 2;
      const newBuffer = Buffer.alloc(newSize);
      extractedBuffer.copy(newBuffer);
      extractedBuffer = newBuffer;
    }

    if (bit) {
      extractedBuffer[byteIndex] |= (1 << bitOffset);
    } else {
      extractedBuffer[byteIndex] &= ~(1 << bitOffset);
    }

    bitIndex++;

    // Check if we have enough for header
    if (!headerParsed && bitIndex === HEADER_SIZE * 8) {
      headerInfo = parseHeader(extractedBuffer.subarray(0, HEADER_SIZE));
      if (headerInfo) {
        headerParsed = true;
        totalBytesNeeded = HEADER_SIZE + headerInfo.length;
        // Resize buffer to exact size needed
        const newBuffer = Buffer.alloc(totalBytesNeeded);
        extractedBuffer.copy(newBuffer, 0, 0, HEADER_SIZE);
        extractedBuffer = newBuffer;
      }
    }
  };

  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const idx = (png.width * y + x) * 4;

      // Extract R channel LSB
      processBit(png.data[idx]! & 1);
      if (headerParsed && bitIndex >= totalBytesNeeded * 8) break;

      // Extract G channel LSB
      processBit(png.data[idx + 1]! & 1);
      if (headerParsed && bitIndex >= totalBytesNeeded * 8) break;

      // Extract B channel LSB
      processBit(png.data[idx + 2]! & 1);
      if (headerParsed && bitIndex >= totalBytesNeeded * 8) break;
    }
    if (headerParsed && bitIndex >= totalBytesNeeded * 8) break;
  }

  if (!headerInfo) {
      // Try to parse header one last time if we ran out of pixels but maybe had enough bits
      // (though processBit should have caught it)
      if (bitIndex >= HEADER_SIZE * 8) {
          headerInfo = parseHeader(extractedBuffer.subarray(0, HEADER_SIZE));
      }

      if (!headerInfo) {
        throw new Error('No hidden data found in image');
      }
  }

  const data = extractedBuffer.subarray(HEADER_SIZE, totalBytesNeeded);

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

    // bitsToBuffer replacement logic
    const magicBuffer = Buffer.alloc(4);
    for (let i = 0; i < 32; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitOffset = 7 - (i % 8);
        if (bits[i]) {
            magicBuffer[byteIndex] |= (1 << bitOffset);
        }
    }
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
