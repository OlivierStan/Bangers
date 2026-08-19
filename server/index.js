require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

let spotifyAccessToken = '';

//In-memory Game State
const room = {
  code: "PARTY1",
  state: "LOBBY", //LOBBY, PROMPT, VOTING, RESULTS
  prompt: "Best song to start a party!",
  submissions: [],
  votes: { A: 0, B: 0 },
  votedPlayers: new Set()
};

//Refresh Spotify Token
async function refreshSpotifyToken() {
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
    spotifyAccessToken = response.data.access_token;
    console.log('Spotify Access Token refreshed!');
  } catch (error) {
    console.error('Error getting Spotify Token:', error.message);
  }
}

refreshSpotifyToken();
setInterval(refreshSpotifyToken, 50 * 60 * 1000);

//Search Spotify Tracks
async function searchSpotifyTrack(query) {
  if (!spotifyAccessToken) return [];
  try {
    const res = await axios.get(`https://api.spotify.com/v1/search`, {
      headers: { Authorization: `Bearer ${spotifyAccessToken}` },
      params: { q: query, type: 'track', limit: 5 }
    });

    return res.data.tracks.items.map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists[0].name,
      albumArt: track.album.images[0]?.url,
      previewUrl: track.preview_url
    }));
  } catch (err) {
    console.error('Spotify Search Error:', err.message);
    return [];
  }
}

//Socket.io Event Handling
io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  //Send initial room state upon joining
  socket.emit('room-state-update', {
    state: room.state,
    prompt: room.prompt,
    submissionsCount: room.submissions.length
  });

  //Handle Song Search
  socket.on('search-song', async (data) => {
    const results = await searchSpotifyTrack(data.query);
    socket.emit('search-results', results);
  });

  //Handle Song Submission (Guest)
  socket.on('submit-song', (track) => {
    //Prevent duplicate submissions from same connection
    const existingIndex = room.submissions.findIndex(s => s.socketId === socket.id);
    if (existingIndex !== -1) {
      room.submissions[existingIndex].track = track;
    } else {
      room.submissions.push({ socketId: socket.id, track });
    }

    console.log(`🎵 Song submitted: ${track.name} (Total: ${room.submissions.length})`);
    
    //Notify Unity & Web clients that submission count updated
    io.emit('submission-updated', { count: room.submissions.length });

    //Auto-trigger battle state when 2 songs are ready
    if (room.submissions.length >= 2 && room.state !== 'VOTING') {
      startBattlePhase();
    }
  });

  //Handle Votes (Guest)
  socket.on('cast-vote', (option) => { // 'A' or 'B'
    if (room.state !== 'VOTING') return;
    if (room.votedPlayers.has(socket.id)) return; //Prevent double voting

    room.votedPlayers.add(socket.id);
    if (option === 'A') room.votes.A++;
    if (option === 'B') room.votes.B++;

    console.log(`Vote for ${option}! Current tally: A=${room.votes.A}, B=${room.votes.B}`);
    io.emit('vote-tally-update', room.votes);
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
  });
});

function startBattlePhase() {
  room.state = 'VOTING';
  room.votes = { A: 0, B: 0 };
  room.votedPlayers.clear();

  const battleData = {
    songA: room.submissions[0].track,
    songB: room.submissions[1].track
  };

  console.log('Battle Started:', battleData.songA.name, 'vs', battleData.songB.name);
  io.emit('start-battle', battleData);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});