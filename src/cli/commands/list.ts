import chalk from 'chalk';
import ora from 'ora';
import {
  vaultExists,
  unlock,
  listEntries,
  isUnlocked,
} from '../../storage/vault/index.js';
import { promptPassword } from '../prompts.js';
import { initializeKeyManager } from '../../crypto/index.js';

export async function listCommand(options?: { filter?: string }): Promise<void> {
  // Check vault exists
  if (!await vaultExists()) {
    console.log(chalk.red('\n  No vault found. Run "slasshy init" first.\n'));
    return;
  }

  // Unlock if needed
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

  // Get entries
  const spinner = ora('Loading entries...').start();

  try {
    let entries = await listEntries();
    spinner.stop();

    // Filter if specified
    if (options?.filter) {
      const filterLower = options.filter.toLowerCase();
      entries = entries.filter(e => e.title.toLowerCase().includes(filterLower));
    }

    if (entries.length === 0) {
      console.log(chalk.yellow('\n  No entries found.\n'));
      console.log(chalk.gray('  Use "slasshy add" to create your first entry.\n'));
      return;
    }

    // Display entries
    console.log('');
    console.log(chalk.bold(`  ${entries.length} Entries`));
    console.log(chalk.gray('  ' + '─'.repeat(50)));

    const maxTitleLen = Math.min(30, Math.max(...entries.map(e => e.title.length)));

    for (const entry of entries) {
      const title = entry.title.length > 30
        ? entry.title.substring(0, 27) + '...'
        : entry.title.padEnd(maxTitleLen);
      const date = new Date(entry.modified).toLocaleDateString();

      console.log(`  ${chalk.cyan(title)}  ${chalk.gray(date)}`);
    }

    console.log(chalk.gray('  ' + '─'.repeat(50)));
    console.log(chalk.gray(`  Total: ${entries.length} entries\n`));
  } catch (error) {
    spinner.fail('Failed to list entries');
    if (error instanceof Error) {
      console.log(chalk.red(`  ${error.message}`));
    }
  }
}
