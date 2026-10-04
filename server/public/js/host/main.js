// Host screen entry point: wires the socket, buttons and modules together
import { $ } from '../shared/utils.js';
import { startBackground } from './background.js';
import { initSpotify, setLoggedIn, unlockAudio } from './spotify-player.js';
import { getSelectedCategories } from './categories.js';
import { renderHost } from './render.js';

const socket = io();
let latestState = null;

// QR code to the guest page (works on localhost and on the ngrok domain)
new QRCode($('qrcode'), {
  text: window.location.origin,
  width: 150,
  height: 150,
  colorDark: "#121212",
  colorLight: "#ffffff",
  correctLevel: QRCode.CorrectLevel.H
});

startBackground($('canvas-container'), () => latestState?.state === 'RESULTS');
initSpotify(socket);

// --- Host actions ---
function hostAction(event, payload) {
  unlockAudio();
  socket.emit(event, payload);
}

$('startBtn').onclick = () => hostAction('host-start-game', { isFirstRound: true, categories: getSelectedCategories() });
$('voteBtn').onclick = () => hostAction('host-start-voting');
$('endVoteBtn').onclick = () => hostAction('host-end-voting');
$('nextRoundBtn').onclick = () => hostAction('host-start-game', { isFirstRound: false });
$('resetBtn').onclick = () => {
  if (confirm('Start a new game? All scores will be reset.')) hostAction('host-reset-game');
};

// --- Server events ---
socket.on('connect', () => socket.emit('host-register'));
socket.on('disconnect', () => {
  $('status').textContent = 'Lost connection to server, reconnecting…';
});

socket.on('host-state', (s) => {
  latestState = s;
  setLoggedIn(s.spotifyLoggedIn);
  renderHost(s);
});
