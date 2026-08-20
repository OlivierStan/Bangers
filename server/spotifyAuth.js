// server/spotifyAuth.js
const crypto = require('crypto');
const axios = require('axios');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'https://127.0.0.1:3000/callback';

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-modify-playback-state',
  'user-read-playback-state'
].join(' ');

let codeVerifier = null;
let hostTokens = { accessToken: null, refreshToken: null, expiresAt: 0 };

function base64url(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function generatePKCEPair() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function getLoginUrl() {
  const { verifier, challenge } = generatePKCEPair();
  codeVerifier = verifier;

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function storeTokens(data) {
  hostTokens.accessToken = data.access_token;
  if (data.refresh_token) hostTokens.refreshToken = data.refresh_token;
  hostTokens.expiresAt = Date.now() + (data.expires_in - 60) * 1000;
}

async function handleCallback(code) {
  const response = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET,
      code_verifier: codeVerifier
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  storeTokens(response.data);
  return hostTokens;
}

async function refreshIfNeeded() {
  if (!hostTokens.refreshToken) throw new Error('Host has not logged into Spotify yet');
  if (Date.now() < hostTokens.expiresAt) return hostTokens.accessToken;

  const response = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: hostTokens.refreshToken,
      client_id: CLIENT_ID
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  storeTokens(response.data);
  return hostTokens.accessToken;
}

function isLoggedIn() {
  return !!hostTokens.refreshToken;
}

module.exports = { getLoginUrl, handleCallback, refreshIfNeeded, isLoggedIn };