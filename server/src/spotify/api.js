const axios = require('axios');
const spotifyAuth = require('./auth');

let clientCredentialsToken = '';
let hostDeviceId = null;

// Refresh Client Credentials Token (Fallback)
async function refreshClientCredentialsToken() {
  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({ grant_type: 'client_credentials' }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(
            process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
          ).toString('base64')
        }
      }
    );
    clientCredentialsToken = response.data.access_token;
    console.log('Client Credentials Token refreshed!');
  } catch (error) {
    console.error('Error getting Spotify Client Credentials Token:', error.response?.data || error.message);
  }
}

function startTokenRefresh() {
  refreshClientCredentialsToken();
  setInterval(refreshClientCredentialsToken, 50 * 60 * 1000);
}

// Search Spotify Tracks (With dynamic token resolution)
async function searchTracks(query) {
  let token = clientCredentialsToken;

  // Try using the logged-in Host token first, fallback to client credentials
  try {
    if (spotifyAuth.isLoggedIn()) {
      token = await spotifyAuth.refreshIfNeeded();
    }
  } catch (err) {
    console.warn('Host token unavailable, using Client Credentials token for search.');
  }

  if (!token) {
    console.error('Spotify Search Failed: No access token available.');
    return [];
  }

  try {
    const res = await axios.get(`https://api.spotify.com/v1/search`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { q: query, type: 'track', limit: 8 }
    });

    return res.data.tracks.items.map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map(a => a.name).join(', ') || 'Unknown Artist',
      albumArt: track.album.images[0]?.url || ''
    }));
  } catch (err) {
    console.error('Spotify Search API Error:', err.response?.data || err.message);
    return [];
  }
}

async function playTrackOnHost(trackId) {
  if (!hostDeviceId) {
    console.warn('No host device registered — open /host.html and log in first.');
    return;
  }
  try {
    const accessToken = await spotifyAuth.refreshIfNeeded();
    await axios.put(
      `https://api.spotify.com/v1/me/player/play?device_id=${hostDeviceId}`,
      { uris: [`spotify:track:${trackId}`] },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
  } catch (err) {
    console.error('Playback error:', err.response?.data || err.message);
  }
}

function setHostDevice(deviceId) {
  hostDeviceId = deviceId;
  console.log('Host playback device registered:', deviceId);
}

function hasHostDevice() {
  return !!hostDeviceId;
}

module.exports = { startTokenRefresh, searchTracks, playTrackOnHost, setHostDevice, hasHostDevice };
