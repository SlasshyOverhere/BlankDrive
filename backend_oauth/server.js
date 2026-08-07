import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { pathToFileURL } from 'node:url';

dotenv.config();

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_STATE_ENTRIES = 4096;
const MAX_RATE_BUCKETS = 4096;
const BODY_LIMIT = '10kb';

/**
 * Only loopback HTTP redirect URIs are allowed. HTTPS is required for any
 * non-loopback deployment, but OAuth callback redirects are always local.
 */
export function isAllowedRedirectUri(uri) {
  if (typeof uri !== 'string' || !uri) {
    return false;
  }

  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:') {
    return false;
  }
  if (parsed.username || parsed.password) {
    return false;
  }
  if (!parsed.port) {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const isLoopback =
    hostname === 'localhost' ||
    hostname === '::1' ||
    /^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/.test(hostname);

  return isLoopback;
}

export function validateEnvironment(env) {
  if (!env || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error(
      'Missing required environment variables: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET',
    );
  }
}

function createStateStore() {
  const store = new Map();
  const order = [];

  function prune(now = Date.now()) {
    const cutoff = now - STATE_TTL_MS;
    for (const [key, entry] of store) {
      if (entry.createdAt < cutoff) {
        store.delete(key);
      }
    }
    while (order.length && !store.has(order[0])) {
      order.shift();
    }
  }

  return {
    set(key, value) {
      prune();
      if (store.size >= MAX_STATE_ENTRIES) {
        while (order.length && !store.has(order[0])) {
          order.shift();
        }
        const oldest = order.shift();
        if (oldest) {
          store.delete(oldest);
        }
      }
      if (!store.has(key)) {
        order.push(key);
      }
      store.set(key, value);
    },
    get(key) {
      const entry = store.get(key);
      if (!entry) {
        return undefined;
      }
      if (Date.now() - entry.createdAt > STATE_TTL_MS) {
        store.delete(key);
        return undefined;
      }
      return entry;
    },
    delete(key) {
      return store.delete(key);
    },
  };
}

function createRateLimiter(maxRequests, windowMs) {
  const buckets = new Map();
  const order = [];

  function evictOldest() {
    while (order.length && !buckets.has(order[0])) {
      order.shift();
    }
    const oldestKey = order.shift();
    if (oldestKey) {
      buckets.delete(oldestKey);
    }
  }

  function pruneExpired(now) {
    if (buckets.size < MAX_RATE_BUCKETS) {
      return;
    }
    const cutoff = now - windowMs;
    for (const [key, record] of buckets) {
      record.times = record.times.filter((ts) => ts > cutoff);
      if (record.times.length === 0) {
        buckets.delete(key);
      }
    }
  }

  return function rateLimit(req, res, next) {
    const now = Date.now();
    pruneExpired(now);

    const clientIP = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    const key = `${clientIP}:${req.path}`;

    let record = buckets.get(key);
    if (!record) {
      if (buckets.size >= MAX_RATE_BUCKETS) {
        evictOldest();
      }
      record = { times: [] };
      buckets.set(key, record);
      order.push(key);
    } else {
      record.times = record.times.filter((ts) => ts > now - windowMs);
    }

    if (record.times.length >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    record.times.push(now);
    next();
  };
}

export function createApp(env, { oauth2Client, fetch } = {}) {
  validateEnvironment(env);

  const FRONTEND_URL = env.FRONTEND_URL || 'http://localhost:4310';
  const client =
    oauth2Client ||
    new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      `${FRONTEND_URL}/api/oauth/callback`,
    );
  const globalFetch = fetch || globalThis.fetch;
  const stateStore = createStateStore();
  const pendingExchanges = new Set();
  const rateLimit = createRateLimiter(
    parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10) || 10,
    parseInt(env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
  );

  const app = express();
  app.set('trust proxy', false);
  app.use(
    cors({
      origin: FRONTEND_URL,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: BODY_LIMIT }));
  app.use(rateLimit);

  const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.appdata',
  ];

  /**
   * GET /api/oauth/generate-url
   * Generates a Google authorization URL using the frontend-provided PKCE
   * material. Redirect URIs are restricted to loopback.
   */
  app.get('/api/oauth/generate-url', (req, res) => {
    try {
      const redirectUri = req.query.redirect_uri || `${FRONTEND_URL}/api/oauth/callback`;
      const state = req.query.state;
      const codeChallenge = req.query.code_challenge;
      const codeChallengeMethod = req.query.code_challenge_method || 'S256';
      const codeVerifier = req.query.code_verifier;

      if (!state || !codeChallenge || !codeVerifier) {
        return res.status(400).json({
          error: 'Missing required parameters: state, code_challenge, and code_verifier are required',
        });
      }

      if (codeChallengeMethod !== 'S256') {
        return res.status(400).json({ error: 'Invalid PKCE parameters.' });
      }
      if (
        typeof codeVerifier !== 'string' ||
        typeof codeChallenge !== 'string' ||
        typeof state !== 'string' ||
        state.length < 8
      ) {
        return res.status(400).json({ error: 'Invalid PKCE parameters.' });
      }

      const computedChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');
      if (computedChallenge !== codeChallenge) {
        return res.status(400).json({ error: 'Invalid PKCE parameters.' });
      }

      if (!isAllowedRedirectUri(redirectUri)) {
        return res.status(400).json({ error: 'Invalid redirect URI.' });
      }

      stateStore.set(state, {
        codeVerifier,
        redirectUri,
        createdAt: Date.now(),
      });

      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        redirect_uri: redirectUri,
      });

      res.json({ authUrl, state, codeVerifier, redirectUri });
    } catch (error) {
      console.error('Error generating auth URL:', error);
      res.status(500).json({ error: 'Failed to generate authorization URL' });
    }
  });

  /**
   * POST /api/oauth/exchange-code
   * Exchanges an authorization code for tokens. Requires a valid, unexpired
   * state that was issued by this server and an exact redirect-URI match.
   */
  app.post('/api/oauth/exchange-code', async (req, res) => {
    try {
      const { code, state, redirect_uri: redirectUri } = req.body || {};

      if (!code || !state) {
        return res.status(400).json({
          error: 'Missing code or state',
          received: { hasCode: !!code, hasState: !!state },
        });
      }

      const stored = stateStore.get(state);
      if (!stored) {
        return res.status(400).json({ error: 'Invalid or expired OAuth state.' });
      }

      // redirect_uri is optional; when omitted, use the one bound at
      // generate-url time. When provided it must match exactly.
      const effectiveRedirectUri = redirectUri || stored.redirectUri;
      if (redirectUri !== undefined && redirectUri !== stored.redirectUri) {
        stateStore.delete(state);
        return res.status(400).json({ error: 'Invalid or expired OAuth state.' });
      }

      if (pendingExchanges.has(state)) {
        return res.status(409).json({ error: 'OAuth exchange already in progress.' });
      }
      pendingExchanges.add(state);

      const postData = new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: effectiveRedirectUri,
        grant_type: 'authorization_code',
        code_verifier: stored.codeVerifier,
      });

      try {
        const response = await globalFetch(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: postData.toString(),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error_description || data.error || 'Google OAuth error');
        }

        const tokens = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expiry_date: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
        };

        if (!tokens.access_token) {
          throw new Error('No access token received');
        }

        stateStore.delete(state);
        res.json({ success: true, tokens });
      } finally {
        pendingExchanges.delete(state);
      }
    } catch (error) {
      console.error('Error exchanging code:', error);
      res.status(500).json({ error: 'Failed to exchange authorization code' });
    }
  });

  /**
   * POST /api/oauth/refresh-token
   * Intentionally disabled. Refresh tokens must remain client-side.
   */
  app.post('/api/oauth/refresh-token', (req, res) => {
    res.status(410).json({
      error: 'Refresh endpoint disabled; refresh tokens must remain client-side.',
    });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/', (req, res) => {
    res.json({
      service: 'BlankDrive OAuth Backend',
      version: '1.0.0',
      endpoints: {
        'GET /api/oauth/generate-url': 'Generate OAuth authorization URL',
        'POST /api/oauth/exchange-code': 'Exchange code for tokens',
        'POST /api/oauth/refresh-token': 'Disabled; refresh tokens remain client-side',
        'GET /health': 'Health check',
      },
    });
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body too large.' });
    }
    if (err instanceof SyntaxError && err.status === 400) {
      return res.status(400).json({ error: 'Invalid JSON body.' });
    }
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

export function startServer(env, options) {
  const app = createApp(env, options);
  const host = env.OAUTH_HOST || '0.0.0.0';
  const port = env.PORT !== undefined && env.PORT !== '' ? parseInt(env.PORT, 10) : 3410;

  const server = app.listen(port, host, () => {
    const clientId = String(env.GOOGLE_CLIENT_ID || '').substring(0, 20);
    console.log(`BlankDrive OAuth Backend running on http://${host}:${port}`);
    console.log(`Frontend URL: ${env.FRONTEND_URL || 'http://localhost:4310'}`);
    console.log(`Google Client ID: ${clientId}...`);
  });
  return server;
}

const defaultEnv = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:4310',
  PORT: process.env.PORT,
  OAUTH_HOST: process.env.OAUTH_HOST,
  RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
};

let defaultApp;
try {
  validateEnvironment(defaultEnv);
  defaultApp = createApp(defaultEnv);
} catch (error) {
  console.error('❌ Missing required environment variables');
  console.error('Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file');
}

export default defaultApp;

// Start only when this module is the main entrypoint (including `?main-guard`
// test imports that re-enter with a real entry path).
const isMain =
  process.argv[1] &&
  import.meta.url.startsWith(pathToFileURL(process.argv[1]).href);
if (isMain && defaultApp) {
  startServer(defaultEnv);
}
