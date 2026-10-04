// HTTP routes for the host's Spotify login
const express = require('express');
const spotifyAuth = require('./spotify/auth');

const router = express.Router();

router.get('/login', (req, res) => {
  res.redirect(spotifyAuth.getLoginUrl());
});

router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.send(`Spotify login failed: ${error}`);
  try {
    await spotifyAuth.handleCallback(code);
    res.redirect('/host.html');
  } catch (err) {
    console.error('Spotify callback error:', err.response?.data || err.message);
    res.status(500).send('Login failed, check server logs.');
  }
});

router.get('/host-token', async (req, res) => {
  try {
    if (!spotifyAuth.isLoggedIn()) return res.json({ error: 'not_logged_in' });
    const accessToken = await spotifyAuth.refreshIfNeeded();
    res.json({ accessToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
