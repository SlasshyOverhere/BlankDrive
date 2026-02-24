import chalk from 'chalk';
import { startWebUiServer } from '../../webui/server.js';
import { openExternalUrl } from '../openExternal.js';

interface WebCommandOptions {
  port?: string;
  open?: boolean;
}

function parsePort(rawPort: string | undefined): number {
  if (!rawPort) {
    return 4310;
  }

  const parsed = Number.parseInt(rawPort, 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error('Port must be a number between 1 and 65535.');
  }

  return parsed;
}

export async function webCommand(options: WebCommandOptions = {}): Promise<void> {
  const host = 'localhost';
  const port = parsePort(options.port);

  try {
    const server = await startWebUiServer({ host, port });
    console.log(chalk.bold('\n  BlankDrive Web UI\n'));
    console.log(`  ${chalk.gray('URL:')} ${chalk.cyan(server.url)}`);
    console.log(`  ${chalk.gray('Bind:')} ${host}:${port}`);
    console.log(chalk.gray('  Press Ctrl+C to stop.\n'));

    if (options.open) {
      try {
        await openExternalUrl(server.url);
      } catch (error) {
        if (error instanceof Error) {
          console.log(chalk.yellow(`  Could not auto-open browser: ${error.message}`));
        }
      }
    }

    const shutdown = async (): Promise<void> => {
      console.log(chalk.gray('\n  Shutting down web UI...'));
      await server.close();
      process.exit(0);
    };

    process.once('SIGINT', () => {
      void shutdown();
    });
    process.once('SIGTERM', () => {
      void shutdown();
    });
  } catch (error) {
    if (error instanceof Error) {
      console.log(chalk.red(`\n  Failed to start web UI: ${error.message}\n`));
      return;
    }
    console.log(chalk.red('\n  Failed to start web UI.\n'));
  }
}
