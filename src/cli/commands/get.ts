import chalk from 'chalk';
import ora from 'ora';
import clipboardy from 'clipboardy';
import {
  vaultExists,
  unlock,
  searchEntries,
  getEntry,
  isUnlocked,
  type Entry,
} from '../../storage/vault/index.js';
import { promptPassword, promptSelectEntry } from '../prompts.js';
import { initializeKeyManager } from '../../crypto/index.js';

export async function getCommand(
  searchTerm?: string,
  options?: { copy?: boolean; showPassword?: boolean }
): Promise<void> {
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

  // Search for entries
  const query = searchTerm || '';
  const spinner = ora('Searching...').start();

  let entries: Entry[];
  try {
    entries = await searchEntries(query);
    spinner.stop();
  } catch (error) {
    spinner.fail('Search failed');
    if (error instanceof Error) {
      console.log(chalk.red(`  ${error.message}`));
    }
    return;
  }

  if (entries.length === 0) {
    console.log(chalk.yellow(`\n  No entries found${query ? ` matching "${query}"` : ''}.\n`));
    return;
  }

  // Select entry if multiple matches
  let entry: Entry;
  if (entries.length === 1) {
    entry = entries[0]!;
  } else {
    console.log(chalk.gray(`\n  Found ${entries.length} entries:\n`));
    const selectedId = await promptSelectEntry(
      entries.map(e => ({ id: e.id, title: e.title, modified: e.modified }))
    );
    if (!selectedId) {
      return;
    }
    entry = entries.find(e => e.id === selectedId)!;
  }

  // Display entry
  displayEntry(entry, options?.showPassword);

  // Copy password if requested
  if (options?.copy && entry.password) {
    try {
      await clipboardy.write(entry.password);
      console.log(chalk.green('  Password copied to clipboard!'));
      console.log(chalk.gray('  (Will be cleared in 30 seconds)\n'));

      // Clear clipboard after 30 seconds
      setTimeout(async () => {
        try {
          const current = await clipboardy.read();
          if (current === entry.password) {
            await clipboardy.write('');
          }
        } catch {
          // Ignore clipboard errors
        }
      }, 30000);
    } catch {
      console.log(chalk.yellow('  Could not copy to clipboard.\n'));
    }
  }
}

function displayEntry(entry: Entry, showPassword: boolean = false): void {
  console.log('');
  console.log(chalk.bold.cyan(`  ${entry.title}`));
  console.log(chalk.gray('  ' + '─'.repeat(40)));

  if (entry.username) {
    console.log(`  ${chalk.gray('Username:')} ${entry.username}`);
  }

  if (entry.password) {
    if (showPassword) {
      console.log(`  ${chalk.gray('Password:')} ${entry.password}`);
    } else {
      console.log(`  ${chalk.gray('Password:')} ${'*'.repeat(12)} ${chalk.gray('(use --show-password to reveal)')}`);
    }
  }

  if (entry.url) {
    console.log(`  ${chalk.gray('URL:')} ${entry.url}`);
  }

  if (entry.notes) {
    console.log(`  ${chalk.gray('Notes:')}`);
    entry.notes.split('\n').forEach(line => {
      console.log(chalk.gray(`    ${line}`));
    });
  }

  console.log(chalk.gray('  ' + '─'.repeat(40)));
  console.log(chalk.gray(`  Created: ${new Date(entry.created).toLocaleString()}`));
  console.log(chalk.gray(`  Modified: ${new Date(entry.modified).toLocaleString()}`));
  console.log('');
}
