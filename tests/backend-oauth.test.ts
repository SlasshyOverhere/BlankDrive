import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const importEnvironment = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
};
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-client-secret';

const {
  createApp,
  isAllowedRedirectUri,
  startServer,
  validateEnvironment,
  default: defaultApp,
} = await import('../backend_oauth/server.js');

if (importEnvironment.GOOGLE_CLIENT_ID === undefined) delete process.env.GOOGLE_CLIENT_ID;
else process.env.GOOGLE_CLIENT_ID = importEnvironment.GOOGLE_CLIENT_ID;
if (importEnvironment.GOOGLE_CLIENT_SECRET === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
else process.env.GOOGLE_CLIENT_SECRET = importEnvironment.GOOGLE_CLIENT_SECRET;

type OAuthClient = {
  generateAuthUrl: ReturnType<typeof vi.fn>;
  setCredentials: ReturnType<typeof vi.fn>;
  refreshAccessToken: ReturnType<typeof vi.fn>;
};

type App = ReturnType<typeof createApp>;

const environment = {
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  FRONTEND_URL: 'http://localhost:4310',
};

function responseJson(data: unknown, ok = true) {
  return {
    ok,
    status: ok ? 200 : 400,
    json: vi.fn().mockResolvedValue(data),
  };
}

function makeApp(options: {
  env?: Record<string, string>;
  oauth?: Partial<OAuthClient>;
  fetch?: ReturnType<typeof vi.fn>;
} = {}) {
  const oauth: OAuthClient = {
    generateAuthUrl: vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth'),
    setCredentials: vi.fn(),
    refreshAccessToken: vi.fn().mockResolvedValue({
      credentials: { access_token: 'refreshed-token', expiry_date: 12345 },
    }),
    ...options.oauth,
  };
  const fetch = options.fetch || vi.fn();
  const app = createApp({ ...environment, ...options.env }, { oauth2Client: oauth, fetch });
  return { app, oauth, fetch };
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

async function generate(baseUrl: string, overrides: Record<string, string> = {}) {
  const codeVerifier = overrides.code_verifier || 'v'.repeat(43);
  const codeChallenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier)))
    .toString('base64url');
  const query = new URLSearchParams({
    state: 'state-with-at-least-16-chars',
    code_challenge: codeChallenge,
    code_verifier: codeVerifier,
    ...overrides,
  });
  return request(baseUrl, `/api/oauth/generate-url?${query}`);
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('backend OAuth helpers', () => {
  it('validates required environment and loopback callback URLs', () => {
    expect(() => validateEnvironment(environment)).not.toThrow();
    expect(() => validateEnvironment({ GOOGLE_CLIENT_ID: 'id' })).toThrow(
      'Missing required environment variables: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET',
    );
    expect(() => validateEnvironment({ GOOGLE_CLIENT_SECRET: 'secret' })).toThrow();

    for (const uri of [
      'http://localhost:4310/api/oauth/callback',
      'http://localhost:3411/',
      'http://127.0.0.1:4310/api/oauth/callback',
      'http://localhost:3412/',
    ]) {
      expect(isAllowedRedirectUri(uri)).toBe(true);
    }
    for (const uri of [
      'https://localhost/api/oauth/callback',
      'http://example.com/api/oauth/callback',
      'http://localhost/other',
      'http://user:password@localhost/api/oauth/callback',
      'not a URL',
    ]) {
      expect(isAllowedRedirectUri(uri)).toBe(false);
    }
    expect(isAllowedRedirectUri(undefined as unknown as string)).toBe(false);
  });

  it('serves the default exported app health and service routes', async () => {
    await withServer(defaultApp, async (baseUrl) => {
      const health = await request(baseUrl, '/health');
      expect(health.status).toBe(200);
      const healthBody = await health.json();
      expect(healthBody.status).toBe('ok');
      expect(Number.isNaN(Date.parse(healthBody.timestamp))).toBe(false);

      const root = await request(baseUrl, '/');
      expect(root.status).toBe(200);
      await expect(root.json()).resolves.toEqual(expect.objectContaining({
        service: 'BlankDrive OAuth Backend',
        version: '1.0.0',
        endpoints: expect.objectContaining({
          'GET /health': 'Health check',
          'POST /api/oauth/refresh-token': 'Disabled; refresh tokens remain client-side',
        }),
      }));
    });
  });

  it('generates authorization URLs and rejects invalid request or PKCE data', async () => {
    const { app, oauth } = makeApp();
    await withServer(app, async (baseUrl) => {
      const missing = await request(baseUrl, '/api/oauth/generate-url');
      expect(missing.status).toBe(400);
      await expect(missing.json()).resolves.toEqual({
        error: 'Missing required parameters: state, code_challenge, and code_verifier are required',
      });

      const invalidRedirect = await generate(baseUrl, { redirect_uri: 'https://evil.example/callback' });
      expect(invalidRedirect.status).toBe(400);
      await expect(invalidRedirect.json()).resolves.toEqual({ error: 'Invalid redirect URI.' });

      const invalidPkce = await generate(baseUrl, { code_challenge: 'wrong' });
      expect(invalidPkce.status).toBe(400);
      await expect(invalidPkce.json()).resolves.toEqual({ error: 'Invalid PKCE parameters.' });

      const invalidMethod = await generate(baseUrl, { code_challenge_method: 'plain' });
      expect(invalidMethod.status).toBe(400);
      await expect(invalidMethod.json()).resolves.toEqual({ error: 'Invalid PKCE parameters.' });

      const valid = await generate(baseUrl, { redirect_uri: 'http://localhost:4310/api/oauth/callback' });
      expect(valid.status).toBe(200);
      const body = await valid.json();
      expect(body).toEqual({
        authUrl: 'https://accounts.google.com/o/oauth2/auth',
        state: 'state-with-at-least-16-chars',
        codeVerifier: 'v'.repeat(43),
        redirectUri: 'http://localhost:4310/api/oauth/callback',
      });
      expect(oauth.generateAuthUrl).toHaveBeenCalledWith(expect.objectContaining({
        access_type: 'offline',
        code_challenge_method: 'S256',
        state: body.state,
        redirect_uri: body.redirectUri,
      }));
    });
  });

  it('returns a generic error when authorization URL generation fails', async () => {
    const { app } = makeApp({ oauth: { generateAuthUrl: vi.fn().mockImplementation(() => { throw new Error('provider failed'); }) } });
    await withServer(app, async (baseUrl) => {
      const response = await generate(baseUrl);
      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({ error: 'Failed to generate authorization URL' });
    });
  });

  it('exchanges a stored code, validates state, and handles token failures', async () => {
    const fetch = vi.fn().mockResolvedValue(responseJson({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      expires_in: 3600,
    }));
    const { app } = makeApp({ fetch });
    await withServer(app, async (baseUrl) => {
      const missing = await request(baseUrl, '/api/oauth/exchange-code', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'c' }),
      });
      expect(missing.status).toBe(400);
      await expect(missing.json()).resolves.toEqual({ error: 'Missing code or state', received: { hasCode: true, hasState: false } });

      const unknownState = await request(baseUrl, '/api/oauth/exchange-code', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'c', state: 'unknown' }),
      });
      expect(unknownState.status).toBe(400);
      await expect(unknownState.json()).resolves.toEqual(expect.objectContaining({ error: expect.stringContaining('Invalid or expired OAuth state') }));

      const generated = await generate(baseUrl);
      const generatedBody = await generated.json();
      const exchanged = await request(baseUrl, '/api/oauth/exchange-code', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'auth-code', state: generatedBody.state, redirect_uri: generatedBody.redirectUri }),
      });
      expect(exchanged.status).toBe(200);
      const exchangedBody = await exchanged.json();
      expect(exchangedBody.success).toBe(true);
      expect(exchangedBody.tokens).toMatchObject({ access_token: 'access-token', refresh_token: 'refresh-token' });
      expect(exchangedBody.tokens.expiry_date).toBeGreaterThan(Date.now());
      const sentBody = new URLSearchParams(fetch.mock.calls[0][1].body);
      expect(sentBody.get('code')).toBe('auth-code');
      expect(sentBody.get('code_verifier')).toBe('v'.repeat(43));

      const reused = await request(baseUrl, '/api/oauth/exchange-code', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'auth-code', state: generatedBody.state }),
      });
      expect(reused.status).toBe(400);

      const mismatch = await generate(baseUrl);
      const mismatchBody = await mismatch.json();
      const mismatched = await request(baseUrl, '/api/oauth/exchange-code', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'c', state: mismatchBody.state, redirect_uri: 'http://localhost:4310/api/oauth/callback/other' }),
      });
      expect(mismatched.status).toBe(400);
      await expect(mismatched.json()).resolves.toEqual({ error: 'Invalid or expired OAuth state.' });
    });
  });

  it('handles OAuth exchange provider errors and missing access tokens', async () => {
    const fetch = vi.fn();
    const { app } = makeApp({ fetch });
    await withServer(app, async (baseUrl) => {
      fetch.mockResolvedValueOnce(responseJson({ error_description: 'denied' }, false));
      const first = await generate(baseUrl);
      const firstBody = await first.json();
      const providerError = await request(baseUrl, '/api/oauth/exchange-code', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'c', state: firstBody.state }),
      });
      expect(providerError.status).toBe(500);
      await expect(providerError.json()).resolves.toEqual({ error: 'Failed to exchange authorization code' });

      fetch.mockResolvedValueOnce(responseJson({ refresh_token: 'only-refresh' }));
      const second = await generate(baseUrl);
      const secondBody = await second.json();
      const missingToken = await request(baseUrl, '/api/oauth/exchange-code', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'c', state: secondBody.state }),
      });
      expect(missingToken.status).toBe(500);

      fetch.mockRejectedValueOnce(new Error('network down'));
      const third = await generate(baseUrl);
      const thirdBody = await third.json();
      const networkError = await request(baseUrl, '/api/oauth/exchange-code', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'c', state: thirdBody.state }),
      });
      expect(networkError.status).toBe(500);
    });
  });

  it('rejects expired state and malformed JSON through error handlers', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const { app } = makeApp();
    await withServer(app, async (baseUrl) => {
      const generated = await generate(baseUrl);
      const generatedBody = await generated.json();
      clock.mockReturnValue(1_700_000_000_001 + 10 * 60 * 1000);
      const expired = await request(baseUrl, '/api/oauth/exchange-code', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'c', state: generatedBody.state }),
      });
      expect(expired.status).toBe(400);
      await expect(expired.json()).resolves.toEqual({ error: 'Invalid or expired OAuth state.' });

      clock.mockRestore();
      const malformed = await request(baseUrl, '/api/oauth/exchange-code', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
      });
      expect(malformed.status).toBe(400);
      await expect(malformed.json()).resolves.toEqual({ error: 'Invalid JSON body.' });
    });
  });

  it('keeps refresh tokens client-side', async () => {
    const { app, oauth } = makeApp();
    await withServer(app, async (baseUrl) => {
      const response = await request(baseUrl, '/api/oauth/refresh-token', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refresh_token: 'refresh' }),
      });
      expect(response.status).toBe(410);
      await expect(response.json()).resolves.toEqual({ error: 'Refresh endpoint disabled; refresh tokens must remain client-side.' });
      expect(oauth.setCredentials).not.toHaveBeenCalled();
      expect(oauth.refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  it('applies per-route rate limits and starts on a configured host and port', async () => {
    const { app } = makeApp({ env: { RATE_LIMIT_MAX_REQUESTS: '2', RATE_LIMIT_WINDOW_MS: '60000' } });
    await withServer(app, async (baseUrl) => {
      expect((await request(baseUrl, '/health')).status).toBe(200);
      expect((await request(baseUrl, '/health')).status).toBe(200);
      const limited = await request(baseUrl, '/health');
      expect(limited.status).toBe(429);
      await expect(limited.json()).resolves.toEqual({ error: 'Too many requests. Please try again later.' });
    });

    const server = startServer({ ...environment, PORT: '0', OAUTH_HOST: '127.0.0.1' });
    await new Promise<void>((resolve) => server.once('listening', resolve));
    expect(server.listening).toBe(true);
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  });
});
