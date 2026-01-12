import chalk from 'chalk';
import ora from 'ora';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  performOAuthFlow,
  isAuthenticated,
  setOAuthServerUrl,
  logout,
} from '../../storage/drive/index.js';
import {
  vaultExists,
  unlock,
  isUnlocked,
} from '../../storage/vault/index.js';
import { promptPassword, promptConfirm } from '../prompts.js';
import { initializeKeyManager } from '../../crypto/index.js';

const execAsync = promisify(exec);

/**
 * Open URL in default browser
 */
async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;

  let command: string;
  if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  try {
    await execAsync(command);
  } catch {
    console.log(chalk.yellow(`\n  Please open this URL in your browser:`));
    console.log(chalk.cyan(`  ${url}\n`));
  }
}

export async function authCommand(options?: {
  server?: string;
  logout?: boolean;
}): Promise<void> {
  console.log(chalk.bold('\n  Google Drive Authentication\n'));

  // Handle logout
  if (options?.logout) {
    const spinner = ora('Logging out...').start();
    try {
      await logout();
      spinner.succeed('Logged out from Google Drive');
      console.log(chalk.gray('\n  Your Drive tokens have been removed.\n'));
    } catch (error) {
      spinner.fail('Logout failed');
      if (error instanceof Error) {
        console.log(chalk.red(`  ${error.message}`));
      }
    }
    return;
  }

  // Check if vault exists (needed for token encryption)
  if (!await vaultExists()) {
    console.log(chalk.red('  No vault found. Run "slasshy init" first.'));
    console.log(chalk.gray('  The vault is needed to securely store your Drive tokens.\n'));
    return;
  }

  // Unlock vault if needed
  if (!isUnlocked()) {
    initializeKeyManager();
    const password = await promptPassword();

    const spinner = ora('Unlocking vault...').start();
    try {
      await unlock(password);
      spinner.succeed('Vault unlocked');
    } catch (error) {
      spinner.fail('Failed to unlock vault');
      if (error instanceof Error) {
        console.log(chalk.red(`  ${error.message}`));
      }
      return;
    }
  }

  // Set custom server URL if provided
  if (options?.server) {
    await setOAuthServerUrl(options.server);
    console.log(chalk.gray(`  Using OAuth server: ${options.server}\n`));
  }

  // Check if already authenticated
  if (await isAuthenticated()) {
    console.log(chalk.yellow('  Already authenticated with Google Drive.'));
    const reauth = await promptConfirm('Re-authenticate?');
    if (!reauth) {
      console.log(chalk.gray('\n  Use "slasshy auth --logout" to disconnect.\n'));
      return;
    }
  }

  // Perform OAuth flow
  console.log(chalk.gray('  Opening browser for Google authentication...\n'));

  const spinner = ora('Waiting for authorization...').start();

  try {
    await performOAuthFlow(openBrowser);
    spinner.succeed('Google Drive connected');

    console.log(chalk.green('\n  Successfully connected to Google Drive!'));
    console.log(chalk.gray('  Your tokens are encrypted and stored locally.'));
    console.log(chalk.gray('\n  You can now use "slasshy sync" to upload your entries.\n'));
  } catch (error) {
    spinner.fail('Authentication failed');
    if (error instanceof Error) {
      console.log(chalk.red(`\n  ${error.message}\n`));
    }
  }
}
