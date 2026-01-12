import { randomInt, calculateChecksum, verifyChecksum } from '../crypto/index.js';

export interface Fragment {
  index: number;
  total: number;
  data: Buffer;
  checksum: string;
}

// Fragment header: index(2) + total(2) + checksum(8) + dataLength(4) = 16 bytes
const FRAGMENT_HEADER_SIZE = 16;

/**
 * Fragment data into multiple chunks
 */
export function fragmentData(
  data: Buffer,
  maxChunkSize: number = 524288, // 512KB default
  minChunkSize: number = 65536 // 64KB minimum
): Fragment[] {
  if (data.length <= minChunkSize) {
    // No need to fragment small data
    return [{
      index: 0,
      total: 1,
      data,
      checksum: calculateChecksum(data),
    }];
  }

  const fragments: Fragment[] = [];
  let offset = 0;

  // Calculate number of fragments
  const avgChunkSize = (minChunkSize + maxChunkSize) / 2;
  const estimatedFragments = Math.ceil(data.length / avgChunkSize);
  const actualFragments = Math.max(2, Math.min(estimatedFragments, 100));

  // Calculate chunk sizes with some randomization
  const chunkSizes: number[] = [];
  let remainingBytes = data.length;

  for (let i = 0; i < actualFragments - 1; i++) {
    const remainingFragments = actualFragments - i;
    const avgRemaining = remainingBytes / remainingFragments;
    const variance = Math.min(avgRemaining * 0.3, maxChunkSize - minChunkSize);

    let chunkSize = Math.floor(avgRemaining + randomInt(-variance, variance));
    chunkSize = Math.max(minChunkSize, Math.min(maxChunkSize, chunkSize));
    chunkSize = Math.min(chunkSize, remainingBytes - (remainingFragments - 1) * minChunkSize);

    chunkSizes.push(chunkSize);
    remainingBytes -= chunkSize;
  }
  chunkSizes.push(remainingBytes); // Last chunk gets the rest

  // Create fragments
  for (let i = 0; i < chunkSizes.length; i++) {
    const chunkData = data.subarray(offset, offset + chunkSizes[i]!);
    fragments.push({
      index: i,
      total: chunkSizes.length,
      data: chunkData,
      checksum: calculateChecksum(chunkData),
    });
    offset += chunkSizes[i]!;
  }

  return fragments;
}

/**
 * Serialize a fragment for embedding (includes header)
 */
export function serializeFragment(fragment: Fragment): Buffer {
  const header = Buffer.alloc(FRAGMENT_HEADER_SIZE);

  // Index (2 bytes)
  header.writeUInt16BE(fragment.index, 0);

  // Total (2 bytes)
  header.writeUInt16BE(fragment.total, 2);

  // Checksum (8 bytes)
  Buffer.from(fragment.checksum, 'hex').copy(header, 4);

  // Data length (4 bytes)
  header.writeUInt32BE(fragment.data.length, 12);

  return Buffer.concat([header, fragment.data]);
}

/**
 * Deserialize a fragment from embedded data
 */
export function deserializeFragment(buffer: Buffer): Fragment {
  if (buffer.length < FRAGMENT_HEADER_SIZE) {
    throw new Error('Invalid fragment: too short');
  }

  const index = buffer.readUInt16BE(0);
  const total = buffer.readUInt16BE(2);
  const checksum = buffer.subarray(4, 12).toString('hex');
  const dataLength = buffer.readUInt32BE(12);

  if (buffer.length < FRAGMENT_HEADER_SIZE + dataLength) {
    throw new Error('Invalid fragment: data truncated');
  }

  const data = buffer.subarray(FRAGMENT_HEADER_SIZE, FRAGMENT_HEADER_SIZE + dataLength);

  // Verify checksum
  if (!verifyChecksum(data, checksum)) {
    throw new Error('Fragment checksum verification failed');
  }

  return { index, total, data, checksum };
}

/**
 * Reassemble fragments into original data
 */
export function reassembleFragments(fragments: Fragment[]): Buffer {
  if (fragments.length === 0) {
    throw new Error('No fragments to reassemble');
  }

  // Verify we have all fragments
  const total = fragments[0]!.total;
  if (fragments.length !== total) {
    throw new Error(`Missing fragments: expected ${total}, got ${fragments.length}`);
  }

  // Sort by index
  const sorted = [...fragments].sort((a, b) => a.index - b.index);

  // Verify indices are sequential
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i]!.index !== i) {
      throw new Error(`Missing fragment at index ${i}`);
    }
  }

  // Concatenate data
  return Buffer.concat(sorted.map(f => f.data));
}

/**
 * Calculate total size of fragmented data (with headers)
 */
export function calculateFragmentedSize(fragments: Fragment[]): number {
  return fragments.reduce(
    (sum, f) => sum + FRAGMENT_HEADER_SIZE + f.data.length,
    0
  );
}
