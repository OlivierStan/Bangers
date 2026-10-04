const promptsData = require('../prompts');

const MIN_PLAYERS = 2;

// Phones drop their connection when the screen locks, so a recently disconnected
// player is still waited on for a short while before the round moves on without them.
const RECONNECT_GRACE_MS = 20 * 1000;

// In-memory Game State
// Players are keyed by a persistent playerId (stored in the phone's localStorage),
// so a phone that locks its screen / reconnects keeps its name and points.
const room = {
  state: "LOBBY",          // LOBBY | SUBMISSION | VOTING | RESULTS
  categories: [],
  activePrompts: [],
  currentPromptIndex: 0,
  round: 0,
  prompt: null,
  submissions: [],         // { playerId, track }
  votes: {},               // playerId -> submission index
  players: {},             // playerId -> { name, points, socketId, disconnectedAt }
  results: null
};

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function buildPromptList(categories) {
  const valid = (categories || []).filter(cat => promptsData[cat]);
  const chosen = valid.length === 0 || categories.includes("All")
    ? Object.keys(promptsData)
    : valid;

  const prompts = [];
  chosen.forEach(cat => prompts.push(...promptsData[cat]));
  return { categories: chosen, prompts: shuffleArray(prompts) };
}

function expectedPlayerIds() {
  const now = Date.now();
  return Object.keys(room.players).filter(id => {
    const p = room.players[id];
    return p.socketId || (p.disconnectedAt && now - p.disconnectedAt < RECONNECT_GRACE_MS);
  });
}

function sortedScores() {
  return Object.values(room.players)
    .map(p => ({ name: p.name, points: p.points, connected: !!p.socketId }))
    .sort((a, b) => b.points - a.points);
}

function sanitizeTrack(track) {
  if (!track || typeof track !== 'object' || typeof track.id !== 'string') return null;
  return {
    id: track.id.slice(0, 64),
    name: String(track.name || 'Unknown Track').slice(0, 200),
    artist: String(track.artist || 'Unknown Artist').slice(0, 200),
    albumArt: typeof track.albumArt === 'string' && track.albumArt.startsWith('https://') ? track.albumArt : ''
  };
}

module.exports = {
  room,
  MIN_PLAYERS,
  RECONNECT_GRACE_MS,
  shuffleArray,
  buildPromptList,
  expectedPlayerIds,
  sortedScores,
  sanitizeTrack
};
