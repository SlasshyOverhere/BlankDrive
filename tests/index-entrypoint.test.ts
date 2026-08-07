import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const names = [
    'initCommand', 'addCommand', 'getCommand', 'listCommand', 'deleteCommand', 'editCommand',
    'favoriteCommand', 'listFavoritesCommand', 'noteCommand', 'auditCommand', 'statusCommand',
    'lockCommand', 'authCommand', 'uploadCommand', 'downloadCommand', 'destructCommand',
    'generateCommand', 'settingsCommand', 'webCommand', 'desktopCommand', 'updateCommand',
    'runScheduledUpdateCheckPrompt', 'totpCommand', 'syncCommand', 'showSyncHelp', 'quickGenerate',
  ] as const;
  return Object.fromEntries(names.map((name) => [name, vi.fn().mockResolvedValue(undefined)]));
});

vi.mock('../src/cli/commands/index.js', () => mocks);
vi.mock('../src/cli/shell.js', () => ({ startShell: vi.fn().mockResolvedValue(undefined) }));

const originalArgv = process.argv;

async function runCli(...args: string[]): Promise<void> {
  vi.resetModules();
  process.argv = ['node', '/tmp/blankdrive.js', ...args];
  await import('../src/index.js');
  await new Promise((resolve) => setImmediate(resolve));
}

afterEach(() => {
  process.argv = originalArgv;
  vi.clearAllMocks();
});

describe('CLI entrypoint', () => {
  it('runs the shell with no arguments and skips scheduled work when restarted', async () => {
    mocks.runScheduledUpdateCheckPrompt.mockResolvedValueOnce(false);
    await runCli();
    const shell = await import('../src/cli/shell.js');
    expect(shell.startShell).toHaveBeenCalledOnce();
  });

  it('dispatches representative commands and maps options', async () => {
    await runCli('version');
    await runCli('generate', '--length', '12', '--preset', 'strong', '--passphrase', '--words', '4', '--copy', '--no-symbols');
    await runCli('get', 'search', '--copy', '--show-password');
    await runCli('list', '--filter', 'x', '--type', 'passwords', '--category', 'work');
    await runCli('init', '--drive', '--restore');
    await runCli('desktop', '--release', 'v1', '--output', '/tmp/x', '--asset', 'a.exe', '--force', '--install', '--yes');
    await runCli('update', '--check', '--install', '--release', 'v1', '--current-version', '1.0.0', '--asset', 'a.exe', '--output', '/tmp/x', '--force', '--yes', '--json', '--scheduled');
    expect(mocks.generateCommand).toHaveBeenCalled();
    expect(mocks.getCommand).toHaveBeenCalledWith('search', { copy: true, showPassword: true });
    expect(mocks.listCommand).toHaveBeenCalledWith({ filter: 'x', type: 'passwords', category: 'work' });
    expect(mocks.initCommand).toHaveBeenCalledWith({ drive: true, restore: true });
    expect(mocks.desktopCommand).toHaveBeenCalled();
    expect(mocks.updateCommand).toHaveBeenCalled();
  });

  it('registers and dispatches remaining command families', async () => {
    const commands: Array<[string, string[]]> = [
      ['add', []], ['upload', ['file']], ['download', ['file']], ['delete', ['entry', '--force']],
      ['edit', ['entry']], ['favorite', ['entry']], ['favorites', []], ['note', ['list']],
      ['audit', ['--all']], ['status', []], ['settings', ['--storage', 'hidden', '--folder', 'data']],
      ['web', ['--port', '4310', '--open']], ['lock', []], ['auth', ['--setup', '--logout']],
      ['destruct', []],
    ];
    for (const [command, args] of commands) await runCli(command, ...args);
    expect(mocks.addCommand).toHaveBeenCalled();
    expect(mocks.noteCommand).toHaveBeenCalled();
    expect(mocks.noteCommand).toHaveBeenCalled();
  });

  it('returns before parsing when scheduled update restarts the process', async () => {
    mocks.runScheduledUpdateCheckPrompt.mockResolvedValueOnce(true);
    await runCli('add');
    expect(mocks.addCommand).not.toHaveBeenCalled();
  });
});
