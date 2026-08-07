import { beforeEach, describe, expect, it, vi } from 'vitest';

const drive = vi.hoisted(() => ({ authenticateDrive: vi.fn(), isDriveConnected: vi.fn(), uploadToAppData: vi.fn(), downloadFromAppData: vi.fn(), downloadAppDataToBuffer: vi.fn(), deleteFromAppData: vi.fn(), listAppDataFiles: vi.fn(), hasAppDataAccess: vi.fn() }));
const fs = vi.hoisted(() => ({ stat: vi.fn(), access: vi.fn(), mkdir: vi.fn() }));
const fsSync = vi.hoisted(() => ({ createWriteStream: vi.fn() }));
const os = vi.hoisted(() => ({ freemem: vi.fn(() => 3 * 1024 ** 3), tmpdir: vi.fn(() => '/tmp') }));
const crypto = vi.hoisted(() => ({ decryptFromBuffer: vi.fn((data: Buffer) => data), decryptFromPayload: vi.fn((data: string) => Buffer.from(data)) }));
vi.mock('../src/storage/drive/driveClient.js', () => drive);
vi.mock('fs/promises', () => ({ default: fs }));
vi.mock('fs', () => ({ default: fsSync }));
vi.mock('os', () => ({ default: os }));
vi.mock('../src/crypto/index.js', () => crypto);
import * as sync from '../src/storage/drive/fileSyncService.js';

const writer = () => ({ write: vi.fn(), end: vi.fn((callback: (error?: Error) => void) => callback()) });

describe('File sync remaining direct branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    drive.isDriveConnected.mockReturnValue(true);
    drive.listAppDataFiles.mockResolvedValue([]);
    drive.hasAppDataAccess.mockReturnValue(true);
    drive.uploadToAppData.mockResolvedValue('uploaded');
    drive.downloadFromAppData.mockResolvedValue(undefined);
    drive.deleteFromAppData.mockResolvedValue(undefined);
    fs.stat.mockResolvedValue({ size: 10 });
    fs.access.mockRejectedValue(new Error('missing'));
    fs.mkdir.mockResolvedValue(undefined);
    fsSync.createWriteStream.mockReturnValue(writer());
  });

  it('rejects missing chunks and handles single upload/download and idempotency', async () => {
    fs.stat.mockRejectedValue(new Error('missing'));
    await expect(sync.uploadFileToCloud('entry', 2)).rejects.toThrow('Missing encrypted chunk 1/2');
    fs.stat.mockResolvedValue({ size: 7 });
    drive.listAppDataFiles.mockResolvedValue([{ name: 'slasshy_entry_chunk_0.bin', id: 'existing' }]);
    await expect(sync.uploadFileToCloud('entry', 1, vi.fn())).resolves.toEqual([{ chunkIndex: 0, driveFileId: 'existing', size: 7 }]);
    fs.access.mockResolvedValue(undefined);
    await sync.downloadFileFromCloud('entry', [{ chunkIndex: 0, driveFileId: 'existing', size: 7 }], vi.fn());
    expect(drive.downloadFromAppData).not.toHaveBeenCalled();
  });

  it('covers sequential stream download, legacy fallback, write errors, and low/medium RAM', async () => {
    os.freemem.mockReturnValue(512 * 1024 ** 2);
    const w = writer();
    fsSync.createWriteStream.mockReturnValue(w);
    drive.downloadAppDataToBuffer.mockResolvedValueOnce(Buffer.from('a')).mockResolvedValueOnce(Buffer.from('b'));
    crypto.decryptFromBuffer.mockImplementationOnce((data: Buffer) => data).mockImplementationOnce(() => { throw new Error('legacy'); });
    const progress: number[] = [];
    await sync.streamDownloadToFile('entry', [{ chunkIndex: 1, driveFileId: 'b', size: 1 }, { chunkIndex: 0, driveFileId: 'a', size: 1 }], '/tmp/output', Buffer.alloc(32), (done) => progress.push(done));
    expect(w.write).toHaveBeenCalledTimes(2);
    expect(progress).toEqual([1, 2]);
    os.freemem.mockReturnValue(1024 * 1024 ** 2);
    expect(sync.getParallelismInfo().level).toBe(2);
  });

  it('covers parallel ordered streaming and write callback errors', async () => {
    os.freemem.mockReturnValue(3 * 1024 ** 3);
    const w = writer();
    fsSync.createWriteStream.mockReturnValue(w);
    drive.downloadAppDataToBuffer.mockImplementation(async (id: string) => Buffer.from(id));
    await sync.streamDownloadToFile('entry', [
      { chunkIndex: 2, driveFileId: 'c', size: 1 }, { chunkIndex: 0, driveFileId: 'a', size: 1 }, { chunkIndex: 1, driveFileId: 'b', size: 1 },
    ], '/tmp/output', Buffer.alloc(32));
    expect(w.write).toHaveBeenCalledTimes(3);
    const failing = { write: vi.fn(), end: vi.fn((callback: (error?: Error) => void) => callback(new Error('close failed'))) };
    fsSync.createWriteStream.mockReturnValue(failing);
    drive.downloadAppDataToBuffer.mockResolvedValue(Buffer.from('x'));
    await expect(sync.streamDownloadToFile('entry', [{ chunkIndex: 0, driveFileId: 'a', size: 1 }], '/tmp/output', Buffer.alloc(32))).rejects.toThrow('close failed');
  });

  it('covers deletion errors, cloud completeness, usage, auth, and access', async () => {
    drive.isDriveConnected.mockReturnValueOnce(false).mockReturnValue(true);
    drive.deleteFromAppData.mockRejectedValueOnce(new Error('not found')).mockRejectedValueOnce(new Error('bad')).mockRejectedValueOnce({});
    await expect(sync.deleteFileFromCloud('entry', [{ chunkIndex: 2, driveFileId: 'c', size: 1 }, { chunkIndex: 0, driveFileId: 'a', size: 1 }, { chunkIndex: 1, driveFileId: 'b', size: 1 }])).rejects.toThrow('Chunk 1');
    drive.listAppDataFiles.mockResolvedValue([{ name: 'slasshy_entry_chunk_0.bin' }, { name: 'slasshy_entry_chunk_1.bin' }]);
    await expect(sync.isFileInCloud('entry', 2)).resolves.toBe(true);
    drive.listAppDataFiles.mockResolvedValue([{ name: 'x', size: '12' }, { name: 'y', size: undefined }]);
    await expect(sync.getCloudStorageUsage()).resolves.toEqual({ fileCount: 2, totalBytes: 12 });
    drive.hasAppDataAccess.mockReturnValue(false);
    await expect(sync.isCloudSyncAvailable()).resolves.toBe(false);
  });
});
