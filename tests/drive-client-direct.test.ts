import { describe, expect, it, vi } from 'vitest';

const fs = vi.hoisted(() => ({ readFile: vi.fn(), writeFile: vi.fn(), mkdir: vi.fn(), access: vi.fn(), unlink: vi.fn() }));
vi.mock('fs/promises', () => ({ default: fs }));
vi.mock('../src/crypto/index.js', () => ({
  encryptToPayload: vi.fn((value: string) => value),
  decryptToString: vi.fn((value: string) => value),
  getMetadataKey: vi.fn(() => Buffer.from('key')),
}));
vi.mock('googleapis', () => ({ google: { drive: vi.fn() }, drive_v3: {} }));
vi.mock('google-auth-library', () => ({ OAuth2Client: class {}, CodeChallengeMethod: { S256: 'S256' } }));

import {
  getGoogleOAuthCredentials, isGoogleOAuthConfigured, isCloudStorageModeConfigured,
  getCloudStorageMode, setCloudStorageMode, getPublicContentFolderName,
  setPublicContentFolderName, setGoogleOAuthCredentialsForSession,
  setGoogleOAuthCredentials, isAuthenticated, getDriveClient, disconnectDrive,
} from '../src/storage/drive/driveClient.js';

describe('drive client direct configuration and state', () => {
  it('uses defaults and handles invalid persisted configuration', async () => {
    fs.readFile.mockRejectedValue(new Error('missing')); fs.access.mockRejectedValue(new Error('missing'));
    await expect(getGoogleOAuthCredentials()).resolves.toMatchObject({ clientId: expect.any(String) });
    await expect(isGoogleOAuthConfigured()).resolves.toBe(false);
    await expect(isCloudStorageModeConfigured()).resolves.toBe(false);
    await expect(getCloudStorageMode()).resolves.toBe('public');
    await expect(getPublicContentFolderName()).resolves.toBeNull();
    await expect(isAuthenticated()).resolves.toBe(false);
    await expect(setCloudStorageMode('bad' as never)).rejects.toThrow('Invalid cloud storage mode');
    await expect(setPublicContentFolderName('a/b')).rejects.toThrow('Invalid public folder name');
    await expect(setPublicContentFolderName('a\\b')).rejects.toThrow('Invalid public folder name');
    await expect(setGoogleOAuthCredentials('', '')).rejects.toThrow('required');
    expect(() => getDriveClient()).toThrow('not authenticated');
  });

  it('normalizes and persists valid settings and session credentials', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({ mode: 'hidden', publicContentFolderName: ' old ' }));
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);
    await expect(getCloudStorageMode()).resolves.toBe('hidden');
    await expect(getPublicContentFolderName()).resolves.toBe('old');
    await setCloudStorageMode('public');
    await setPublicContentFolderName(' New Folder ');
    expect(fs.writeFile).toHaveBeenCalled();
    setGoogleOAuthCredentialsForSession(' id ', ' secret ');
    await expect(getGoogleOAuthCredentials()).resolves.toEqual({ clientId: 'id', clientSecret: 'secret' });
    expect(() => setGoogleOAuthCredentialsForSession('', '')).toThrow('required');
    disconnectDrive();
  });
});
