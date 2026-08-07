import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const DEFAULT_PORT = 3410;
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_FRONTEND_URL = 'http://localhost:4310';
const STATE_TTL_MS = 10 * 60 * 1000;

export function validateEnvironment(env = process.env) {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Missing required environment variables: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  }
}

export function isAllowedRedirectUri(value) {
  try {
    const url = new URL(value);
    const loopback = url.protocol === 'http:'
      && (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1')
      && (url.port === '3411' || url.port === '3412')
      && url.pathname === '/';
    const frontend = url.protocol === 'http:'
      && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
      && url.port === '4310'
      && url.pathname === '/api/oauth/callback';
    return (loopback || frontend) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function createApp(env = process.env, dependencies = {}) {
  validateEnvironment(env);

  const app = express();
  const frontendUrl = env.FRONTEND_URL || DEFAULT_FRONTEND_URL;
  const defaultRedirectUri = `${frontendUrl}/api/oauth/callback`;
  const rateLimitWindow = parseInt(env.RATE_LIMIT_WINDOW_MS, 10) || 60000;
  const rateLimitMax = parseInt(env.RATE_LIMIT_MAX_REQUESTS, 10) || 10;
  const rateLimitStore = new Map();
  const MAX_RATE_LIMIT_BUCKETS = 4096;
  const codeVerifierStore = new Map();
  const MAX_OAUTH_STATES = 4096;
  const oauth2Client = dependencies.oauth2Client || new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    defaultRedirectUri,
  );
  const fetchImpl = dependencies.fetch || fetch;
  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.appdata',
  ];

  app.use(cors({ origin: frontendUrl, credentials: true }));
  app.use(express.json({ limit: '16kb' }));

  function rateLimitMiddleware(req, res, next) {
    const clientIP = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const key = `${clientIP}:${req.path}`;
    const bucket = rateLimitStore.get(key);
    if (!bucket || now - bucket.windowStart >= rateLimitWindow) {
      if (rateLimitStore.size >= MAX_RATE_LIMIT_BUCKETS) {
        const oldestKey = rateLimitStore.keys().next().value;
        if (oldestKey) rateLimitStore.delete(oldestKey);
      }
      rateLimitStore.set(key, { count: 1, windowStart: now });
      next();
      return;
    }
    if (bucket.count >= rateLimitMax) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    bucket.count += 1;
    next();
  }

  app.use(rateLimitMiddleware);

  app.get('/api/oauth/generate-url', (req, res) => {
    try {
      const redirectUri = req.query.redirect_uri || defaultRedirectUri;
      const state = req.query.state;
      const codeChallenge = req.query.code_challenge;
      const codeChallengeMethod = req.query.code_challenge_method || 'S256';
      const codeVerifier = req.query.code_verifier;

      if (redirectUri !== defaultRedirectUri && !isAllowedRedirectUri(redirectUri)) {
        return res.status(400).json({ error: 'Invalid redirect URI.' });
      }
      if (!state || typeof state !== 'string' || state.length < 16 || state.length > 256
        || !codeChallenge || typeof codeChallenge !== 'string'
        || !codeVerifier || typeof codeVerifier !== 'string'
        || codeVerifier.length < 43 || codeVerifier.length > 128) {
        return res.status(400).json({
          error: 'Missing required parameters: state, code_challenge, and code_verifier are required',
        });
      }

      const computedChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
      if (computedChallenge !== codeChallenge || codeChallengeMethod !== 'S256') {
        return res.status(400).json({ error: 'Invalid PKCE parameters.' });
      }

      if (codeVerifierStore.size >= MAX_OAUTH_STATES && !codeVerifierStore.has(state)) {
        const oldestState = codeVerifierStore.keys().next().value;
        if (oldestState) codeVerifierStore.delete(oldestState);
      }
      codeVerifierStore.set(state, { codeVerifier, codeChallenge, redirectUri, createdAt: Date.now(), exchanging: false });
      const expiry = Date.now() - STATE_TTL_MS;
      for (const [key, value] of codeVerifierStore.entries()) {
        if (value.createdAt < expiry) codeVerifierStore.delete(key);
      }

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline', scope: scopes, prompt: 'consent',
        code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod,
        state, redirect_uri: redirectUri,
      });
      return res.json({ authUrl, state, codeVerifier, redirectUri });
    } catch (error) {
      console.error('Error generating auth URL:', error);
      return res.status(500).json({ error: 'Failed to generate authorization URL' });
    }
  });

  app.post('/api/oauth/exchange-code', async (req, res) => {
    try {
      const { code, state, redirect_uri: requestedRedirectUri } = req.body || {};
      if (!code || !state) {
        return res.status(400).json({
          error: 'Missing code or state',
          received: { hasCode: !!code, hasState: !!state },
        });
      }

      const storedData = codeVerifierStore.get(state);
      if (!storedData) {
        return res.status(400).json({ error: 'Invalid or expired OAuth state.' });
      }

      const { codeVerifier, redirectUri: storedRedirectUri, createdAt } = storedData;
      const redirectUri = requestedRedirectUri || storedRedirectUri;
      if (redirectUri !== storedRedirectUri || Date.now() - createdAt > STATE_TTL_MS) {
        codeVerifierStore.delete(state);
        return res.status(400).json({ error: 'Invalid or expired OAuth state.' });
      }
      if (storedData.exchanging) {
        return res.status(409).json({ error: 'OAuth exchange already in progress.' });
      }
      storedData.exchanging = true;

      try {
        const response = await fetchImpl('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
            code_verifier: codeVerifier,
          }).toString(),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(`Google OAuth error: ${data.error_description || data.error}`);

        const tokens = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expiry_date: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
        };
        if (!tokens.access_token) throw new Error('No access token received');
        codeVerifierStore.delete(state);
        return res.json({ success: true, tokens });
      } catch (error) {
        storedData.exchanging = false;
        throw error;
      }
    } catch (error) {
      console.error('Error exchanging code:', error);
      return res.status(500).json({ error: 'Failed to exchange authorization code' });
    }
  });

  app.post('/api/oauth/refresh-token', (_req, res) => {
    return res.status(410).json({ error: 'Refresh endpoint disabled; refresh tokens must remain client-side.' });
  });

  app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
  app.get('/', (req, res) => res.json({
    service: 'BlankDrive OAuth Backend',
    version: '1.0.0',
    endpoints: {
      'GET /api/oauth/generate-url': 'Generate OAuth authorization URL',
      'POST /api/oauth/exchange-code': 'Exchange code for tokens',
      'POST /api/oauth/refresh-token': 'Disabled; refresh tokens remain client-side',
      'GET /health': 'Health check',
    },
  }));
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (err?.type === 'entity.too.large') {
      res.status(413).json({ error: 'Request body too large.' });
      return;
    }
    if (err instanceof SyntaxError && err.status === 400) {
      res.status(400).json({ error: 'Invalid JSON body.' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

export function startServer(env = process.env) {
  const app = createApp(env);
  const port = Number(env.PORT || DEFAULT_PORT);
  const host = env.OAUTH_HOST || DEFAULT_HOST;
  return app.listen(port, host, () => {
    console.log(`BlankDrive OAuth Backend running on http://${host}:${port}`);
    console.log(`Frontend URL: ${env.FRONTEND_URL || DEFAULT_FRONTEND_URL}`);
    console.log(`Google Client ID: ${env.GOOGLE_CLIENT_ID.substring(0, 20)}...`);
  });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
const app = createApp(process.env);
if (isMain) startServer(process.env);
export default app;
