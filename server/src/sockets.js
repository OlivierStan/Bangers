// Socket.io Event Handling
const spotify = require('./spotify/api');
const { room, RECONNECT_GRACE_MS, sanitizeTrack } = require('./game/state');
const { hostState } = require('./game/views');
const { attach, syncHosts, syncPlayer } = require('./game/sync');
const flow = require('./game/flow');

function registerSockets(io) {
  attach(io);

  io.on('connection', (socket) => {
    console.log(`Connected: ${socket.id}`);

    const getPlayerId = () => {
      const id = socket.data.playerId;
      return id && room.players[id] ? id : null;
    };

    // Host screen registers itself
    socket.on('host-register', () => {
      socket.data.isHost = true;
      socket.join('hosts');
      socket.emit('host-state', hostState());
    });

    // Register (or re-register after reconnect) a player
    socket.on('join-game', (data) => {
      if (!data || typeof data.playerId !== 'string' || data.playerId.length > 64) return;
      const name = String(data.name || '').trim().slice(0, 20) || 'Player';
      const playerId = data.playerId;

      const existing = room.players[playerId];
      if (existing) {
        existing.name = name;
        existing.socketId = socket.id;
      } else {
        room.players[playerId] = { name, points: 0, socketId: socket.id };
      }
      socket.data.playerId = playerId;

      console.log(`Player ${existing ? 'rejoined' : 'joined'}: ${name}`);
      syncPlayer(playerId);
      syncHosts();
    });

    // Handle Song Search
    socket.on('search-song', async (data) => {
      const query = typeof data?.query === 'string' ? data.query.trim().slice(0, 100) : '';
      if (query.length < 2) return;
      const results = await spotify.searchTracks(query);
      socket.emit('search-results', { query: data.query, tracks: results });
    });

    // Handle Song Submission (Guest)
    socket.on('submit-song', (rawTrack) => {
      const playerId = getPlayerId();
      const track = sanitizeTrack(rawTrack);
      if (!playerId || !track || room.state !== 'SUBMISSION') return;

      const existing = room.submissions.find(s => s.playerId === playerId);
      if (existing) {
        existing.track = track;
      } else {
        room.submissions.push({ playerId, track });
      }

      console.log(`Song submitted: ${track.name} (Total: ${room.submissions.length})`);
      syncPlayer(playerId);
      syncHosts();
      flow.checkAutoAdvance();
    });

    // Handle Votes (Guest)
    socket.on('cast-vote', (trackIndex) => {
      const playerId = getPlayerId();
      if (!playerId || room.state !== 'VOTING') return;
      if (!Number.isInteger(trackIndex) || trackIndex < 0 || trackIndex >= room.submissions.length) return;
      if (room.submissions[trackIndex].playerId === playerId) return; // no voting for yourself

      room.votes[playerId] = trackIndex;
      syncPlayer(playerId);
      syncHosts();
      flow.checkAutoAdvance();
    });

    // --- Host-only events ---
    socket.on('host-start-game', (data) => {
      if (!socket.data.isHost) return;
      const isFirstRound = !!data?.isFirstRound;
      if (isFirstRound && room.state !== 'LOBBY') return;
      if (!isFirstRound && room.state !== 'RESULTS') return;
      const categories = Array.isArray(data?.categories) ? data.categories : [];
      flow.startRound(isFirstRound, categories);
    });

    socket.on('host-start-voting', () => {
      if (socket.data.isHost) flow.startVoting();
    });

    socket.on('host-end-voting', () => {
      if (socket.data.isHost) flow.endVoting();
    });

    socket.on('host-reset-game', () => {
      if (socket.data.isHost) flow.resetGame();
    });

    socket.on('host-device-ready', (deviceId) => {
      if (!socket.data.isHost) return;
      spotify.setHostDevice(deviceId);
      syncHosts();
    });

    socket.on('disconnect', () => {
      console.log(`Disconnected: ${socket.id}`);
      const playerId = getPlayerId();
      if (playerId && room.players[playerId].socketId === socket.id) {
        room.players[playerId].socketId = null;
        room.players[playerId].disconnectedAt = Date.now();
        // Players who never got into a game can just be dropped
        if (room.state === 'LOBBY') delete room.players[playerId];
        syncHosts();
        setTimeout(flow.checkAutoAdvance, RECONNECT_GRACE_MS + 100);
      }
    });
  });
}

module.exports = registerSockets;
