import chalk from 'chalk';
import { lock, isUnlocked } from '../../storage/vault/index.js';
import { disconnectDrive } from '../../storage/drive/index.js';

export async function lockCommand(): Promise<void> {
  if (!isUnlocked()) {
    console.log(chalk.yellow('\n  Vault is already locked.\n'));
    return;
  }

  lock();
  disconnectDrive();

  console.log(chalk.green('\n  Vault locked. All keys cleared from memory.\n'));
}
