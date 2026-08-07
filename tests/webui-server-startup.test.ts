import { afterEach, describe, expect, it, vi } from 'vitest';

const httpMock = vi.hoisted(() => ({ createServer: vi.fn() }));
vi.mock('node:http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:http')>();
  return { ...actual, createServer: httpMock.createServer };
});

import { startWebUiServer } from '../src/webui/server.js';

afterEach(() => vi.clearAllMocks());

describe('Web UI startup failure paths', () => {
  it('rejects and removes the listening handler when the server emits an error', async () => {
    const error = Object.assign(new Error('address unavailable'), { code: 'EACCES' });
    const fakeServer = {
      once: vi.fn((event: string, callback: (value?: Error) => void) => {
        if (event === 'error') queueMicrotask(() => callback(error));
        return fakeServer;
      }),
      off: vi.fn(),
      listen: vi.fn(),
      address: vi.fn(),
      close: vi.fn(),
    };
    httpMock.createServer.mockReturnValue(fakeServer);

    await expect(startWebUiServer({ port: 0 })).rejects.toBe(error);
    expect(fakeServer.listen).toHaveBeenCalledWith(0, 'localhost');
    expect(fakeServer.off).toHaveBeenCalledWith('listening', expect.any(Function));
  });

  it('closes the server when listening succeeds without a usable address', async () => {
    const fakeServer = {
      once: vi.fn((event: string, callback: () => void) => {
        if (event === 'listening') queueMicrotask(callback);
        return fakeServer;
      }),
      off: vi.fn(),
      listen: vi.fn(),
      address: vi.fn(() => null),
      close: vi.fn((callback: (error?: Error) => void) => callback()),
    };
    httpMock.createServer.mockReturnValue(fakeServer);

    await expect(startWebUiServer({ port: 0 })).rejects.toThrow('Failed to resolve listening address.');
    expect(fakeServer.address).toHaveBeenCalled();
    expect(fakeServer.close).toHaveBeenCalledWith(expect.any(Function));
  });
});
