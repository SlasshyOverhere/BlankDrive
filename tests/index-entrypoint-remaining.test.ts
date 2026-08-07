import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addCommand: vi.fn().mockResolvedValue(undefined),
  runScheduledUpdateCheckPrompt: vi.fn().mockResolvedValue(false),
  startShell: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/cli/commands/index.js', () => ({
  initCommand: vi.fn(), addCommand: mocks.addCommand, getCommand: vi.fn(), listCommand: vi.fn(),
  deleteCommand: vi.fn(), editCommand: vi.fn(), favoriteCommand: vi.fn(), listFavoritesCommand: vi.fn(),
  noteCommand: vi.fn(), auditCommand: vi.fn(), statusCommand: vi.fn(), lockCommand: vi.fn(),
  authCommand: vi.fn(), uploadCommand: vi.fn(), downloadCommand: vi.fn(), destructCommand: vi.fn(),
  generateCommand: vi.fn(), settingsCommand: vi.fn(), webCommand: vi.fn(), desktopCommand: vi.fn(),
  updateCommand: vi.fn(), runScheduledUpdateCheckPrompt: mocks.runScheduledUpdateCheckPrompt,
}));
vi.mock('../src/cli/shell.js', () => ({ startShell: mocks.startShell }));

const originalArgv = process.argv;

afterEach(() => {
  process.argv = originalArgv;
  vi.clearAllMocks();
});

async function runCli(argv: string[] | { slice: () => unknown[] }): Promise<void> {
  vi.resetModules();
  process.argv = argv as string[];
  await import('../src/index.js');
  await new Promise((resolve) => setImmediate(resolve));
}

describe('CLI entrypoint remaining branches', () => {
  it('returns without parsing when a scheduled check restarts shell mode', async () => {
    mocks.runScheduledUpdateCheckPrompt.mockResolvedValueOnce(true);

    await runCli(['node', '/tmp/blankdrive.js']);

    expect(mocks.startShell).not.toHaveBeenCalled();
  });

  it('parses a non-skipped command after a scheduled check does not restart', async () => {
    mocks.runScheduledUpdateCheckPrompt.mockResolvedValueOnce(false);

    await runCli(['node', '/tmp/blankdrive.js', 'add']);

    expect(mocks.runScheduledUpdateCheckPrompt).toHaveBeenCalledOnce();
    expect(mocks.addCommand).toHaveBeenCalledOnce();
  });

  it('handles an undefined first argument and skips scheduled work for update commands', async () => {
    mocks.runScheduledUpdateCheckPrompt.mockResolvedValueOnce(true);

    await runCli({ slice: () => [undefined] });

    expect(mocks.runScheduledUpdateCheckPrompt).toHaveBeenCalledOnce();

    await runCli(['node', '/tmp/blankdrive.js', 'update']);
    expect(mocks.runScheduledUpdateCheckPrompt).toHaveBeenCalledOnce();
  });
});
