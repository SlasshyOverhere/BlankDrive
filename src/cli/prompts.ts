import inquirer from 'inquirer';
import chalk from 'chalk';

/**
 * Prompt for master password (hidden input)
 */
export async function promptPassword(message: string = 'Master Password'): Promise<string> {
  const { password } = await inquirer.prompt([
    {
      type: 'password',
      name: 'password',
      message: chalk.cyan(message + ':'),
      mask: '*',
      validate: (input: string) => {
        if (input.length < 8) {
          return 'Password must be at least 8 characters';
        }
        return true;
      },
    },
  ]);
  return password;
}

/**
 * Prompt for password confirmation
 */
export async function promptPasswordConfirm(): Promise<string> {
  const { password, confirm } = await inquirer.prompt([
    {
      type: 'password',
      name: 'password',
      message: chalk.cyan('Master Password:'),
      mask: '*',
      validate: (input: string) => {
        if (input.length < 8) {
          return 'Password must be at least 8 characters';
        }
        return true;
      },
    },
    {
      type: 'password',
      name: 'confirm',
      message: chalk.cyan('Confirm Password:'),
      mask: '*',
    },
  ]);

  if (password !== confirm) {
    throw new Error('Passwords do not match');
  }

  return password;
}

/**
 * Prompt for entry details
 */
export async function promptEntryDetails(): Promise<{
  title: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
}> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'title',
      message: chalk.cyan('Title:'),
      validate: (input: string) => input.length > 0 || 'Title is required',
    },
    {
      type: 'input',
      name: 'username',
      message: chalk.cyan('Username (optional):'),
    },
    {
      type: 'password',
      name: 'password',
      message: chalk.cyan('Password (optional):'),
      mask: '*',
    },
    {
      type: 'input',
      name: 'url',
      message: chalk.cyan('URL (optional):'),
    },
    {
      type: 'editor',
      name: 'notes',
      message: chalk.cyan('Notes (optional, opens editor):'),
    },
  ]);

  return {
    title: answers.title,
    username: answers.username || undefined,
    password: answers.password || undefined,
    url: answers.url || undefined,
    notes: answers.notes?.trim() || undefined,
  };
}

/**
 * Prompt for confirmation
 */
export async function promptConfirm(message: string): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: chalk.yellow(message),
      default: false,
    },
  ]);
  return confirmed;
}

/**
 * Prompt for search term
 */
export async function promptSearch(): Promise<string> {
  const { query } = await inquirer.prompt([
    {
      type: 'input',
      name: 'query',
      message: chalk.cyan('Search:'),
    },
  ]);
  return query;
}

/**
 * Select from a list of entries
 */
export async function promptSelectEntry(
  entries: Array<{ id: string; title: string; modified: number }>
): Promise<string | null> {
  if (entries.length === 0) {
    return null;
  }

  const choices = entries.map(e => ({
    name: `${e.title} (modified: ${new Date(e.modified).toLocaleDateString()})`,
    value: e.id,
  }));

  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message: chalk.cyan('Select entry:'),
      choices,
    },
  ]);

  return selected;
}

/**
 * Prompt for carrier image paths
 */
export async function promptCarrierPaths(): Promise<string[]> {
  const { pathsInput } = await inquirer.prompt([
    {
      type: 'input',
      name: 'pathsInput',
      message: chalk.cyan('Carrier image paths (comma-separated):'),
      validate: (input: string) => input.length > 0 || 'At least one path is required',
    },
  ]);

  return pathsInput.split(',').map((p: string) => p.trim());
}
