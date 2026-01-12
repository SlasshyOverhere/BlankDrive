export {
  vaultExists,
  initVaultWithHeader as initVault,
  unlock,
  lock,
  isUnlocked,
  addEntry,
  getEntry,
  searchEntries,
  listEntries,
  updateEntry,
  deleteEntry,
  getStats,
  getVaultPaths,
  getVaultIndex,
  updateVaultIndex,
} from './vaultManager.js';

export {
  createEntry,
  validateEntry,
  validateVaultIndex,
  type Entry,
  type VaultIndex,
  type IndexEntry,
  type VaultConfig,
} from './schema.js';
