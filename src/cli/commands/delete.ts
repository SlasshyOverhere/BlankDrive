import chalk from 'chalk';
import ora from 'ora';
import {
  vaultExists,
  unlock,
  searchEntries,
  deleteEntry,
  isUnlocked,
  type Entry,
} from '../../storage/vault/index.js';
import { promptPassword, promptConfirm, promptSelectEntry } from '../prompts.js';
import { initializeKeyManager } from '../../crypto/index.js';

export async function deleteCommand(
  searchTerm?: string,
  options?: { force?: boolean }
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
  if (!query) {
    console.log(chalk.yellow('\n  Please specify an entry to delete.\n'));
    console.log(chalk.gray('  Usage: slasshy delete <title>\n'));
    return;
  }

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
    console.log(chalk.yellow(`\n  No entries found matching "${query}".\n`));
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

  // Confirm deletion
  if (!options?.force) {
    console.log('');
    const confirmed = await promptConfirm(
      `Delete "${entry.title}"? This cannot be undone.`
    );
    if (!confirmed) {
      console.log(chalk.gray('\n  Cancelled.\n'));
      return;
    }
  }

  // Delete entry
  const deleteSpinner = ora('Deleting entry...').start();

  try {
    await deleteEntry(entry.id);
    deleteSpinner.succeed('Entry deleted');
    console.log(chalk.green(`\n  "${entry.title}" has been deleted.\n`));
  } catch (error) {
    deleteSpinner.fail('Failed to delete entry');
    if (error instanceof Error) {
      console.log(chalk.red(`  ${error.message}`));
    }
  }
}
