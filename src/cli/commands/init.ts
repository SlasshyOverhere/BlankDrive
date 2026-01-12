import chalk from 'chalk';
import ora from 'ora';
import {
  vaultExists,
  initVault,
} from '../../storage/vault/index.js';
import { promptPasswordConfirm } from '../prompts.js';
import { initializeKeyManager } from '../../crypto/index.js';

export async function initCommand(options: { drive?: boolean }): Promise<void> {
  console.log(chalk.bold('\n  Slasshy Vault Initialization\n'));

  // Check if vault already exists
  if (await vaultExists()) {
    console.log(chalk.red('  Vault already exists!'));
    console.log(chalk.gray('  Use "slasshy unlock" to access your vault.'));
    return;
  }

  // Initialize key manager
  initializeKeyManager();

  // Get master password
  console.log(chalk.gray('  Choose a strong master password. This is the only password you need to remember.'));
  console.log(chalk.gray('  IMPORTANT: If you lose this password, your data cannot be recovered!\n'));

  let password: string;
  try {
    password = await promptPasswordConfirm();
  } catch (error) {
    if (error instanceof Error) {
      console.log(chalk.red(`\n  ${error.message}`));
    }
    return;
  }

  // Create vault
  const spinner = ora('Creating encrypted vault...').start();

  try {
    await initVault(password);
    spinner.succeed('Encrypted vault created');
  } catch (error) {
    spinner.fail('Failed to create vault');
    if (error instanceof Error) {
      console.log(chalk.red(`  ${error.message}`));
    }
    return;
  }

  // Success message
  console.log(chalk.green('\n  Vault initialized successfully!\n'));
  console.log(chalk.gray('  Quick start:'));
  console.log(chalk.white('    slasshy add      ') + chalk.gray('Add a new entry'));
  console.log(chalk.white('    slasshy list     ') + chalk.gray('List all entries'));
  console.log(chalk.white('    slasshy get      ') + chalk.gray('Retrieve an entry'));
  console.log(chalk.white('    slasshy auth     ') + chalk.gray('Connect to Google Drive'));
  console.log(chalk.white('    slasshy sync     ') + chalk.gray('Sync with Google Drive'));
  console.log('');

  if (options.drive) {
    console.log(chalk.yellow('  To connect Google Drive, run: slasshy auth\n'));
  }
}
