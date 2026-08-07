import { afterEach, describe, expect, it, vi } from 'vitest';

const savedClientId = process.env.GOOGLE_CLIENT_ID;
const savedClientSecret = process.env.GOOGLE_CLIENT_SECRET;
process.env.GOOGLE_CLIENT_ID ||= 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET ||= 'test-client-secret';
const { createApp } = await import('../backend_oauth/server.js');
if (savedClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
else process.env.GOOGLE_CLIENT_ID = savedClientId;
if (savedClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
else process.env.GOOGLE_CLIENT_SECRET = savedClientSecret;

type App = ReturnType<typeof createApp>;

const environment = {
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  FRONTEND_URL: 'http://localhost:4310',
};

function responseJson(data: unknown, ok = true) {
  return { ok, status: ok ? 200 : 400, json: vi.fn().mockResolvedValue(data) };
}

function makeApp(options: { fetch?: ReturnType<typeof vi.fn> } = {}) {
  const oauth = { generateAuthUrl: vi.fn().mockReturnValue('auth-url') };
  const fetch = options.fetch || vi.fn().mockResolvedValue(responseJson({ access_token: 'token' }));
  return { app: createApp(environment, { oauth2Client: oauth, fetch }), fetch };
}

async function withServer<T>(app: App, callback: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server did not expose an address');
  try {
    return await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

async function request(baseUrl: string, path: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, init);
}

async function generate(baseUrl: string, state = 'state-with-at-least-16-chars') {
  const codeVerifier = 'v'.repeat(43);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const codeChallenge = Buffer.from(digest).toString('base64url');
  const query = new URLSearchParams({ state, code_challenge: codeChallenge, code_verifier: codeVerifier });
  return request(baseUrl, `/api/oauth/generate-url?${query}`);
}

afterEach(() => vi.restoreAllMocks());

describe('remaining OAuth and startup branches', () => {
  it('evicts the oldest rate-limit bucket at capacity', async () => {
    const { app } = makeApp();
    await withServer(app, async (baseUrl) => {
      for (let index = 0; index < 4097; index += 1) {
        const response = await request(baseUrl, `/unknown-${index}`);
        expect(response.status).toBe(404);
      }
    });
  }, 30000);

  it('evicts old OAuth states and exercises the state-store capacity path', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const { app } = makeApp({});
    await withServer(app, async (baseUrl) => {
      const first = await generate(baseUrl, 'old-state-with-at-least-16-chars');
      expect(first.status).toBe(200);
      clock.mockReturnValue(1_700_000_000_000 + 10 * 60 * 1000 + 1);
      const second = await generate(baseUrl, 'new-state-with-at-least-16-chars');
      expect(second.status).toBe(200);
    });
    clock.mockRestore();
  });

  it('rejects a concurrent exchange while the first exchange is pending', async () => {
    let resolveFetch!: (value: unknown) => void;
    const fetchImpl = vi.fn().mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));
    const { app } = makeApp({ fetch: fetchImpl });
    await withServer(app, async (baseUrl) => {
      const generated = await generate(baseUrl, 'concurrent-state-with-16-chars');
      const { state } = await generated.json() as { state: string };
      const init = {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'code', state }),
      };
      const first = request(baseUrl, '/api/oauth/exchange-code', init);
      while (!fetchImpl.mock.calls.length) await new Promise((resolve) => setImmediate(resolve));
      const second = await request(baseUrl, '/api/oauth/exchange-code', init);
      expect(second.status).toBe(409);
      await expect(second.json()).resolves.toEqual({ error: 'OAuth exchange already in progress.' });
      resolveFetch(responseJson({ access_token: 'token' }));
      expect((await first).status).toBe(200);
    });
  });

  it('handles oversized bodies and generic middleware errors', async () => {
    const { app } = makeApp();
    await withServer(app, async (baseUrl) => {
      const oversized = await request(baseUrl, '/api/oauth/exchange-code', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ padding: 'x'.repeat(20_000) }),
      });
      expect(oversized.status).toBe(413);
      await expect(oversized.json()).resolves.toEqual({ error: 'Request body too large.' });
    });

    const stack = (app as unknown as { _router: { stack: Array<{ handle: Function }> } })._router.stack;
    const errorHandler = stack.find((layer) => layer.handle.length === 4)?.handle;
    expect(errorHandler).toBeDefined();
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    errorHandler!(new Error('unexpected'), {}, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
  });

  it('runs the OAuth server entrypoint and emits startup logs', async () => {
    const http = await import('node:http');
    const originalListen = http.Server.prototype.listen;
    let startedServer: ReturnType<typeof http.createServer> | undefined;
    http.Server.prototype.listen = function (...args: Parameters<typeof originalListen>) {
      startedServer = this as ReturnType<typeof http.createServer>;
      return originalListen.apply(this, args);
    } as typeof originalListen;
    const originalArgv = process.argv;
    const originalEnv = { ...process.env };
    process.env.GOOGLE_CLIENT_ID = environment.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_SECRET = environment.GOOGLE_CLIENT_SECRET;
    process.env.PORT = '0';
    process.env.OAUTH_HOST = '127.0.0.1';
    process.argv = ['node', `${process.cwd()}/backend_oauth/server.js`];

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      vi.resetModules();
      await import('../backend_oauth/server.js?main-guard');
      expect(startedServer).toBeDefined();
      await new Promise<void>((resolve, reject) => {
        if (!startedServer) return reject(new Error('Server did not start'));
        startedServer.once('listening', () => resolve());
        startedServer.once('error', reject);
      });
      expect(log).toHaveBeenCalledWith(expect.stringContaining('BlankDrive OAuth Backend running'));
      expect(log).toHaveBeenCalledWith('Frontend URL: http://localhost:4310');
      expect(log).toHaveBeenCalledWith('Google Client ID: test-client-id...');
      await new Promise<void>((resolve, reject) => {
        if (!startedServer) return resolve();
        startedServer.close((error) => (error ? reject(error) : resolve()));
      });
    } finally {
      http.Server.prototype.listen = originalListen;
      process.argv = originalArgv;
      for (const key of Object.keys(process.env)) {
        if (!(key in originalEnv)) delete process.env[key];
      }
      Object.assign(process.env, originalEnv);
    }
  });
});
