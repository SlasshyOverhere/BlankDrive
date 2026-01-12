import { z } from 'zod';

// Entry schema for validation
export const EntrySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(256),
  username: z.string().max(256).optional(),
  password: z.string().max(4096).optional(),
  url: z.string().url().max(2048).optional().or(z.literal('')),
  notes: z.string().max(65536).optional(),
  created: z.number().int().positive(),
  modified: z.number().int().positive(),
});

export type Entry = z.infer<typeof EntrySchema>;

// Vault index entry (encrypted reference)
export const IndexEntrySchema = z.object({
  titleEncrypted: z.string(),
  fragments: z.array(z.string()), // Drive file IDs or local file paths
  carrierType: z.enum(['png', 'jpg', 'decoy']),
  localPath: z.string().optional(), // Path to local carrier file
  created: z.number().int().positive(),
  modified: z.number().int().positive(),
});

export type IndexEntry = z.infer<typeof IndexEntrySchema>;

// Full vault index
export const VaultIndexSchema = z.object({
  version: z.string(),
  salt: z.string(), // Base64 encoded
  keyHash: z.string(), // Base64 encoded, for verification
  entries: z.record(z.string(), IndexEntrySchema),
  metadata: z.object({
    created: z.number().int().positive(),
    lastSync: z.number().int().positive().nullable(),
    entryCount: z.number().int().nonnegative(),
  }),
});

export type VaultIndex = z.infer<typeof VaultIndexSchema>;

// Vault configuration
export const VaultConfigSchema = z.object({
  vaultPath: z.string(),
  carriersPath: z.string(),
  autoLockTimeout: z.number().int().positive().default(300000), // 5 minutes
  autoSync: z.boolean().default(false),
  decoyRatio: z.number().int().nonnegative().default(2),
  preferredCarrier: z.enum(['png', 'jpg']).default('png'),
});

export type VaultConfig = z.infer<typeof VaultConfigSchema>;

// Create empty vault index
export function createEmptyIndex(salt: string, keyHash: string): VaultIndex {
  const now = Date.now();
  return {
    version: '1.0.0',
    salt,
    keyHash,
    entries: {},
    metadata: {
      created: now,
      lastSync: null,
      entryCount: 0,
    },
  };
}

// Create a new entry
export function createEntry(
  title: string,
  data: {
    username?: string;
    password?: string;
    url?: string;
    notes?: string;
  }
): Entry {
  const now = Date.now();
  const id = crypto.randomUUID();

  return EntrySchema.parse({
    id,
    title,
    username: data.username || undefined,
    password: data.password || undefined,
    url: data.url || undefined,
    notes: data.notes || undefined,
    created: now,
    modified: now,
  });
}

// Validate entry
export function validateEntry(entry: unknown): Entry {
  return EntrySchema.parse(entry);
}

// Validate vault index
export function validateVaultIndex(index: unknown): VaultIndex {
  return VaultIndexSchema.parse(index);
}
