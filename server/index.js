require('dotenv').config();
const express = require('express');
const { Server } = require('socket.io');
const axios = require('axios');
const spotifyAuth = require('./spotifyAuth');
const fs = require('fs');
const https = require('https');

const app = express();
app.use(express.static('public'));

const sslOptions = {
  key: fs.readFileSync('./localhost+1-key.pem'),
  cert: fs.readFileSync('./localhost+1.pem')
};

const server = https.createServer(sslOptions, app);
const io = new Server(server, { cors: { origin: "*" } });

let clientCredentialsToken = '';
let hostDeviceId = null;

// In-memory Game State
const room = {
  code: "PARTY1",
  state: "LOBBY", // LOBBY, SUBMISSION, VOTING, RESULTS
  prompts: [
    "Best song to start a party!",
    "Song that makes you feel like a villain",
    "Best late night drive track"
  ],
  currentPromptIndex: 0,
  submissions: [], // [{ socketId, track }]
  votes: {},       // { socketId: submissionIndex }
  scores: {}       // { socketId: { name, points } }
};

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

refreshClientCredentialsToken();
setInterval(refreshClientCredentialsToken, 50 * 60 * 1000);

// Search Spotify Tracks (With dynamic token resolution)
async function searchSpotifyTrack(query) {
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
      params: { q: query, type: 'track', limit: 5 }
    });

    return res.data.tracks.items.map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists[0]?.name || 'Unknown Artist',
      albumArt: track.album.images[0]?.url || '',
      previewUrl: track.preview_url
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

// HTTP Routes
app.get('/login', (req, res) => {
  res.redirect(spotifyAuth.getLoginUrl());
});
 
app.get('/callback', async (req, res) => {
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
 
app.get('/host-token', async (req, res) => {
  try {
    if (!spotifyAuth.isLoggedIn()) return res.json({ error: 'not_logged_in' });
    const accessToken = await spotifyAuth.refreshIfNeeded();
    res.json({ accessToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Socket.io Event Handling
io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  // Register Player
  socket.on('join-game', (playerName) => {
    room.scores[socket.id] = room.scores[socket.id] || { name: playerName, points: 0 };
    console.log(`Player joined: ${playerName}`);
  });

  // Handle Song Search
  socket.on('search-song', async (data) => {
    console.log(`Searching for: "${data.query}"`);
    const results = await searchSpotifyTrack(data.query);
    console.log(`Found ${results.length} results.`);
    socket.emit('search-results', results);
  });

  // Handle Song Submission (Guest)
  socket.on('submit-song', (track) => {
    const existingIndex = room.submissions.findIndex(s => s.socketId === socket.id);
    if (existingIndex !== -1) {
      room.submissions[existingIndex].track = track;
    } else {
      room.submissions.push({ socketId: socket.id, track });
    }

    console.log(`Song submitted: ${track.name} (Total: ${room.submissions.length})`);
    io.emit('submission-updated', { count: room.submissions.length });
  });

  // Host starts round
  socket.on('host-start-game', () => {
    room.submissions = [];
    room.votes = {};
    room.state = "SUBMISSION";
    
    const prompt = room.prompts[room.currentPromptIndex];
    console.log(`Starting round with prompt: "${prompt}"`);
    io.emit('round-started', { prompt });
  });

  // Host triggers voting phase
  socket.on('host-start-voting', () => {
    room.state = 'VOTING';
    const votingData = {
      tracks: room.submissions.map((s, index) => ({ id: index, track: s.track }))
    };

    console.log('Voting phase started.');
    io.emit('start-voting', votingData);

    if (room.submissions.length > 0) {
      playTrackOnHost(room.submissions[0].track.id);
    }
  });

  // Handle Votes (Guest)
  socket.on('cast-vote', (trackIndex) => {
    if (room.state !== 'VOTING') return;
    room.votes[socket.id] = trackIndex;
    console.log(`Vote received for track index ${trackIndex}`);
  });

  socket.on('host-device-ready', (deviceId) => {
    hostDeviceId = deviceId;
    console.log('Host playback device registered:', deviceId);
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on https://127.0.0.1:${PORT}`);
});