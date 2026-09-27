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

const promptsData = {
  "Title Game": [
    "Song With a Color in the Title",
    "Song With a Number in the Title",
    "Song With a Person's Name in the Title",
    "Song With 'Love' in the Title",
    "Song With a Question in the Title",
    "Song With a City or State in the Title",
    "Song With a Weather Word in the Title",
    "Song With an Animal in the Title"
  ],
  "Genre": [
    "Pop",
    "Rock",
    "Rap",
    "EDM",
    "Country",
    "Indie",
    "R&B",
    "Metal",
    "Jazz",
    "Reggae",
    "Punk",
    "Emo",
    "Drill Rap",
    "K-Pop",
    "D&B",
    "Hardstyle"
  ],
  "Decade": [
    "The Roaring 20s",
    "Swing Era 30s",
    "Big Band 40s",
    "Late 50s Rock & Roll",
    "Fab 60s",
    "60s Motown",
    "70s Disco Fever",
    "80s Synth-Pop Anthem",
    "90s Grunge or Alt-Rock",
    "2000s R&B Throwback",
    "A track that instantly transports you to 2012"
  ],
  "Lyrics": [
    "Song About Money",
    "Song About Growing Up",
    "Song About Moving On",
    "Song That Tells a Full Story Start to Finish",
    "Best opening line to a song",
    "A track with the sharpest rap verse",
    "Song with lyrics that belong in a poetry book",
    "A song where the lyrics are completely unintelligible but it still bangs"
  ],
  "World": [
    "Best non-English track",
    "A hit song from a European artist",
    "Latin track that always gets people moving",
    "K-Pop or J-Pop banger",
    "Afrobeats track with the best rhythm",
    "Song featuring a traditional acoustic instrument from around the world"
  ],
  "Wildcard": [
    "A song that sounds like a fever dream",
    "The ultimate heist soundtrack song",
    "Track you would play while walking away from a massive explosion",
    "Song you would use to confuse a Victorian child",
    "The song that plays in your head when you win an argument",
    "A track that sounds like pure chaos"
  ],
  "By Artist": [
    "Song by an Artist Who Writes Their Own Lyrics",
    "Best track by a one-hit wonder",
    "A legendary feature where the guest artist completely stole the song",
    "Song by an artist who is famous for a completely different genre",
    "Best debut single by an artist",
    "A cover song that is genuinely better than the original"
  ],
  "Pop Culture": [
    "Best song from a movie soundtrack",
    "Theme song from a 90s or 2000s TV show",
    "A song popularized by a TikTok or Vine trend",
    "Track from a video game that goes inexplicably hard",
    "The walk-out song for a famous wrestler or fighter",
    "A song intrinsically tied to a specific movie scene"
  ]
};

// In-memory Game State
const room = {
  code: "PARTY1",
  state: "LOBBY",
  prompts: [],
  currentPromptIndex: 0,
  submissions: [],
  votes: {},
  scores: {}
};


function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

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
  socket.on('host-start-game', (data) => {
    if (data && data.isFirstRound) {
      let chosenPrompts = [];
      
      if (data.categories.includes("All") || data.categories.length === 0) {
        Object.values(promptsDatabase).forEach(arr => chosenPrompts.push(...arr));
      } else {
        data.categories.forEach(cat => {
          if (promptsDatabase[cat]) chosenPrompts.push(...promptsDatabase[cat]);
        });
      }

      for (let i = chosenPrompts.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chosenPrompts[i], chosenPrompts[j]] = [chosenPrompts[j], chosenPrompts[i]];
      }
      
      room.activePrompts = chosenPrompts;
      room.currentPromptIndex = 0;
    }

    room.submissions = [];
    room.votes = {};
    room.state = "SUBMISSION";
    
    if (room.currentPromptIndex >= room.activePrompts.length) {
      room.currentPromptIndex = 0;
    }

    const prompt = room.activePrompts[room.currentPromptIndex];
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

  // Host ends voting and shows results
  socket.on('host-end-voting', () => {
    if (room.state !== 'VOTING') return;
    room.state = 'RESULTS';

    const voteCounts = {};
    let maxVotes = 0;
    let winningTrackIndex = -1;

    // Get votes
    Object.values(room.votes).forEach(trackIndex => {
      voteCounts[trackIndex] = (voteCounts[trackIndex] || 0) + 1;
      
      if (voteCounts[trackIndex] > maxVotes) {
        maxVotes = voteCounts[trackIndex];
        winningTrackIndex = trackIndex;
      }
    });

    // Award points
    Object.entries(voteCounts).forEach(([trackIndex, count]) => {
      const submission = room.submissions[trackIndex];
      if (submission && room.scores[submission.socketId]) {
        room.scores[submission.socketId].points += (count);
      }
    });

    // Play winning track
    if (winningTrackIndex !== -1 && room.submissions[winningTrackIndex]) {
      playTrackOnHost(room.submissions[winningTrackIndex].track.id);
    }

    // Send scoreboard data
    io.emit('round-results', { scores: room.scores });
    room.currentPromptIndex = (room.currentPromptIndex + 1) % room.activePrompts.length;
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on https://127.0.0.1:${PORT}`);
});