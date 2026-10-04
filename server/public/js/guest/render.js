// Draws the guest phone from the state the server sends
import { $, esc, plural } from '../shared/utils.js';
import { songCard } from './search.js';

const views = ['joinView', 'submissionView', 'submittedView', 'voteView', 'resultsView'];

export function show(viewId) {
  views.forEach(id => $(id).classList.toggle('hidden', id !== viewId));
}

function renderLobby(s) {
  show(null);
  $('promptText').textContent = `Hey ${s.name}! 👋`;
  $('status').textContent = "You're in! Waiting for the host to start the game…";
}

function renderSubmission(s, editingSubmission) {
  $('promptText').textContent = s.prompt;
  if (s.submission && !editingSubmission) {
    show('submittedView');
    $('submittedCard').innerHTML = `
      <img src="${esc(s.submission.albumArt)}" alt="">
      <h2>${esc(s.submission.name)}</h2>
      <p>${esc(s.submission.artist)}</p>`;
    $('status').textContent = 'Submitted! Waiting for other players…';
  } else {
    show('submissionView');
    $('status').textContent = s.submission ? 'Pick a new song to replace your submission' : '';
  }
}

function renderVoting(s, onVote) {
  show('voteView');
  $('promptText').textContent = s.prompt;
  const list = $('voteList');
  list.innerHTML = '';
  s.tracks.forEach(item => {
    const selected = s.votedFor === item.id;
    const card = songCard(
      item.track,
      item.isOwn ? 'own' : (selected ? 'selected' : ''),
      item.isOwn ? 'YOURS' : (selected ? '✓ VOTED' : '')
    );
    if (!item.isOwn) card.onclick = () => onVote(item.id);
    list.appendChild(card);
  });
  $('status').textContent = s.votedFor === null
    ? 'Vote for your favourite!'
    : 'Vote locked in! Tap another song to change it.';
}

function renderResults(s) {
  show('resultsView');
  $('promptText').textContent = s.prompt;
  const w = s.winner;
  const mine = s.myVotes !== null && s.myVotes !== undefined
    ? `<p>Your song got <strong style="color:#1DB954;">${plural(s.myVotes, 'vote')}</strong></p>`
    : '';
  $('resultsCard').innerHTML = w ? `
    <p>🏆 Winning song</p>
    <img src="${esc(w.track.albumArt)}" alt="">
    <h2>${esc(w.track.name)}</h2>
    <p>${esc(w.track.artist)} — by <strong>${esc(w.playerName)}</strong></p>
    ${mine}
    <p>You have <strong style="color:#1DB954;">${s.points} pts</strong> · Rank #${s.rank}</p>` : '';
  $('status').textContent = 'Check the big screen! Next round coming up…';
}

export function renderGuest(s, { editingSubmission, onVote }) {
  if (s.state === 'LOBBY') renderLobby(s);
  else if (s.state === 'SUBMISSION') renderSubmission(s, editingSubmission);
  else if (s.state === 'VOTING') renderVoting(s, onVote);
  else if (s.state === 'RESULTS') renderResults(s);
}
