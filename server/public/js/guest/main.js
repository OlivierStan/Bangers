// Guest phone entry point: joining, reconnecting and wiring the views together
import { $, storageGet, storageSet } from '../shared/utils.js';
import { initSearch, clearSearch } from './search.js';
import { renderGuest, show } from './render.js';

const socket = io();

// Persistent identity so a locked phone / refresh keeps the same player and points
let playerId = storageGet('bangers-player-id');
if (!playerId) {
  playerId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
  storageSet('bangers-player-id', playerId);
}
let playerName = storageGet('bangers-player-name') || '';
let joined = !!playerName; // Returning players rejoin straight away
let state = null;
let editingSubmission = false;
let renderedKey = null;

function render() {
  if (!state) return;
  renderGuest(state, {
    editingSubmission,
    onVote: id => socket.emit('cast-vote', id)
  });
}

// --- Join ---
if (!joined) show('joinView');

$('joinView').addEventListener('submit', (e) => {
  e.preventDefault();
  playerName = $('nameInput').value.trim().slice(0, 20);
  if (!playerName) return;
  storageSet('bangers-player-name', playerName);
  joined = true;
  socket.emit('join-game', { playerId, name: playerName });
});

socket.on('connect', () => {
  $('connection').classList.add('hidden');
  if (joined) socket.emit('join-game', { playerId, name: playerName });
});
socket.on('disconnect', () => $('connection').classList.remove('hidden'));

// --- Submitting ---
initSearch(socket, (track) => {
  editingSubmission = false;
  socket.emit('submit-song', track);
  clearSearch();
});

$('changeSongBtn').onclick = () => {
  editingSubmission = true;
  render();
  $('searchInput').focus();
};

// --- Server state ---
socket.on('player-state', (s) => {
  // A new phase/round resets any local editing
  const key = `${s.state}-${s.round}`;
  if (key !== renderedKey) {
    editingSubmission = false;
    if (s.state === 'SUBMISSION') clearSearch();
    renderedKey = key;
  }
  state = s;
  render();
});
