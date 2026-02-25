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

  const payloadLength = payload.length;
  let byteIndex = 0;
  let bitPos = 7; // MSB first

  // Embed bits into LSB of RGB channels
  outer: for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (byteIndex >= payloadLength) break outer;

      const idx = (png.width * y + x) * 4; // RGBA

      // Modify R channel LSB
      if (byteIndex < payloadLength) {
        const bit = (payload[byteIndex] >> bitPos) & 1;
        png.data[idx] = (png.data[idx]! & 0xFE) | bit;

        bitPos--;
        if (bitPos < 0) {
            bitPos = 7;
            byteIndex++;
        }
      }

      // Modify G channel LSB
      if (byteIndex < payloadLength) {
        const bit = (payload[byteIndex] >> bitPos) & 1;
        png.data[idx + 1] = (png.data[idx + 1]! & 0xFE) | bit;

        bitPos--;
        if (bitPos < 0) {
            bitPos = 7;
            byteIndex++;
        }
      }

      // Modify B channel LSB
      if (byteIndex < payloadLength) {
        const bit = (payload[byteIndex] >> bitPos) & 1;
        png.data[idx + 2] = (png.data[idx + 2]! & 0xFE) | bit;

        bitPos--;
        if (bitPos < 0) {
            bitPos = 7;
            byteIndex++;
        }
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

  // Phase 1: Read Header
  const headerBuffer = Buffer.alloc(HEADER_SIZE);
  let headerByteIndex = 0;
  let headerBitPos = 7;
  let currentHeaderByte = 0;

  // Phase 2: Read Body
  let dataBuffer: Buffer | null = null;
  let dataByteIndex = 0;
  let dataBitPos = 7;
  let currentDataByte = 0;
  let checksum: string = '';

  outer: for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
       const idx = (png.width * y + x) * 4;

       for (let c = 0; c < 3; c++) { // R, G, B
          const val = png.data[idx + c]!;
          const bit = val & 1;

          if (headerByteIndex < HEADER_SIZE) {
              // Accumulate header bits
              currentHeaderByte = (currentHeaderByte << 1) | bit;
              headerBitPos--;

              if (headerBitPos < 0) {
                  headerBuffer[headerByteIndex] = currentHeaderByte;
                  headerByteIndex++;
                  headerBitPos = 7;
                  currentHeaderByte = 0;

                  if (headerByteIndex === HEADER_SIZE) {
                      // Header complete, parse it
                      const headerInfo = parseHeader(headerBuffer);
                      if (!headerInfo) {
                          throw new Error('No hidden data found in image (Invalid header)');
                      }

                      const { length, checksum: cs } = headerInfo;
                      checksum = cs;
                      dataBuffer = Buffer.alloc(length);
                  }
              }
          } else if (dataBuffer) {
              // Accumulate data bits
              if (dataByteIndex < dataBuffer.length) {
                  currentDataByte = (currentDataByte << 1) | bit;
                  dataBitPos--;

                  if (dataBitPos < 0) {
                      dataBuffer[dataByteIndex] = currentDataByte;
                      dataByteIndex++;
                      dataBitPos = 7;
                      currentDataByte = 0;

                      if (dataByteIndex === dataBuffer.length) {
                          break outer;
                      }
                  }
              }
          }
       }
    }
  }

  if (!dataBuffer || dataByteIndex < dataBuffer.length) {
      // It's possible we ran out of pixels before filling buffer
      throw new Error('No hidden data found in image (Incomplete data)');
  }

  if (!verifyChecksum(dataBuffer, checksum)) {
       throw new Error('Data integrity check failed: checksum mismatch');
  }

  return {
    data: dataBuffer,
    checksum,
  };
}

/**
 * Check if an image has embedded data
 */
export async function hasEmbeddedData(imagePath: string): Promise<boolean> {
  try {
    const png = await loadPNG(imagePath);
    const magicBuffer = Buffer.alloc(4);
    let byteIndex = 0;
    let bitPos = 7;
    let currentByte = 0;

    outer: for (let y = 0; y < png.height; y++) {
      for (let x = 0; x < png.width; x++) {
        const idx = (png.width * y + x) * 4;

        for (let c = 0; c < 3; c++) { // R, G, B
            const val = png.data[idx + c]!;
            const bit = val & 1;

            currentByte = (currentByte << 1) | bit;
            bitPos--;

            if (bitPos < 0) {
                magicBuffer[byteIndex] = currentByte;
                byteIndex++;
                bitPos = 7;
                currentByte = 0;

                if (byteIndex === 4) break outer;
            }
        }
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
