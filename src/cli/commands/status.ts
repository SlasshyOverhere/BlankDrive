import chalk from 'chalk';
import {
  vaultExists,
  isUnlocked,
  getStats,
  getVaultPaths,
} from '../../storage/vault/index.js';
import { isDriveConnected, getSyncStatus } from '../../storage/drive/index.js';

export async function statusCommand(): Promise<void> {
  console.log(chalk.bold('\n  Slasshy Vault Status\n'));

  const paths = getVaultPaths();

  // Check if vault exists
  const exists = await vaultExists();
  console.log(`  ${chalk.gray('Vault:')}      ${exists ? chalk.green('Initialized') : chalk.red('Not initialized')}`);

  if (!exists) {
    console.log(chalk.gray('\n  Run "slasshy init" to create a vault.\n'));
    return;
  }

  // Vault location
  console.log(`  ${chalk.gray('Location:')}   ${paths.dir}`);

  // Lock status
  const unlocked = isUnlocked();
  console.log(`  ${chalk.gray('Status:')}     ${unlocked ? chalk.green('Unlocked') : chalk.yellow('Locked')}`);

  // Entry count (if unlocked)
  if (unlocked) {
    const stats = getStats();
    if (stats) {
      console.log(`  ${chalk.gray('Entries:')}    ${stats.entryCount}`);
      console.log(`  ${chalk.gray('Created:')}    ${new Date(stats.created).toLocaleString()}`);

      if (stats.lastSync) {
        console.log(`  ${chalk.gray('Last sync:')}  ${new Date(stats.lastSync).toLocaleString()}`);
      } else {
        console.log(`  ${chalk.gray('Last sync:')}  ${chalk.yellow('Never')}`);
      }
    }
  }

  // Drive status
  console.log('');
  console.log(chalk.bold('  Google Drive'));
  console.log(chalk.gray('  ' + '─'.repeat(30)));

  const connected = isDriveConnected();
  console.log(`  ${chalk.gray('Connected:')}  ${connected ? chalk.green('Yes') : chalk.yellow('No')}`);

  if (unlocked && connected) {
    const syncStatus = getSyncStatus();
    if (syncStatus.pendingUploads > 0) {
      console.log(`  ${chalk.gray('Pending:')}    ${chalk.yellow(syncStatus.pendingUploads + ' entries need sync')}`);
    } else {
      console.log(`  ${chalk.gray('Pending:')}    ${chalk.green('All synced')}`);
    }
  }

  console.log('');
}
