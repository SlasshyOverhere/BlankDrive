// Cryptography types
export interface EncryptedData {
  iv: Buffer;
  ciphertext: Buffer;
  authTag: Buffer;
}

export interface EncryptedPayload {
  data: string; // Base64 encoded: IV + ciphertext + authTag
  salt?: string; // Base64 encoded salt (for vault)
}

export interface DerivedKeys {
  masterKey: Buffer;
  indexKey: Buffer;
  entryKey: Buffer;
  metadataKey: Buffer;
}

export interface KdfParams {
  timeCost: number;
  memoryCost: number;
  parallelism: number;
  hashLength: number;
}

export const DEFAULT_KDF_PARAMS: KdfParams = {
  timeCost: 3,
  memoryCost: 65536, // 64 MB
  parallelism: 4,
  hashLength: 32,
};

// Storage types
export interface VaultEntry {
  id: string;
  title: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  created: number;
  modified: number;
}

export interface VaultIndex {
  version: string;
  salt: string;
  entries: {
    [id: string]: {
      titleEncrypted: string;
      fragments: string[]; // Drive file IDs
      carrierType: string;
      created: number;
      modified: number;
    };
  };
  metadata: {
    created: number;
    lastSync: number | null;
    entryCount: number;
  };
}

export interface VaultConfig {
  vaultPath: string;
  autoLockTimeout: number;
  autoSync: boolean;
  decoyRatio: number;
  preferredCarrier: 'png' | 'jpg';
}

// Drive types
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  modifiedTime?: string;
}

export interface SyncState {
  lastSync: number;
  pendingUploads: string[];
  pendingDownloads: string[];
}

// Steganography types
export interface CarrierInfo {
  path: string;
  capacity: number;
  width: number;
  height: number;
}

export interface EmbedResult {
  carrierPath: string;
  bytesEmbedded: number;
  checksum: string;
}

export interface FragmentInfo {
  index: number;
  total: number;
  data: Buffer;
  checksum: string;
}
