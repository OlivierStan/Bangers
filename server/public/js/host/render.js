// Draws the host screen from the state the server sends
import { $, esc, plural } from '../shared/utils.js';
import { renderCategories } from './categories.js';

let categoriesRendered = false;

function show(viewId) {
  ['lobbyView', 'submissionView', 'votingView', 'resultsView'].forEach(id => {
    $(id).classList.toggle('hidden', id !== viewId);
  });
}

function playerChips(players, flag) {
  if (players.length === 0) return '<span style="color: var(--muted);">No players yet — scan the QR code!</span>';
  return players.map(p => {
    let cls = 'chip';
    if (!p.connected) cls += ' offline';
    else if (flag && p[flag]) cls += ' done';
    return `<span class="${cls}">${flag && p[flag] ? '✓ ' : ''}${esc(p.name)}</span>`;
  }).join('');
}

function trackCard(track) {
  return `<div class="track">
    <img src="${esc(track.albumArt)}" alt="">
    <div class="t-name">${esc(track.name)}</div>
    <div class="t-artist">${esc(track.artist)}</div>
  </div>`;
}

export function renderSpotifyStatus(s) {
  const el = $('spotifyStatus');
  if (!s.spotifyLoggedIn) {
    el.innerHTML = '🔇 Music off — <a href="/login">Log in with Spotify</a>';
  } else if (!s.hasPlaybackDevice) {
    el.textContent = '🎧 Spotify connecting…';
  } else {
    el.textContent = '🎧 Spotify ready';
  }
}

function renderLobby(s) {
  const connectedCount = s.players.filter(p => p.connected).length;
  const enough = connectedCount >= s.minPlayers;

  show('lobbyView');
  $('promptDisplay').textContent = 'Bangers';
  if (!categoriesRendered) {
    renderCategories($('categoryChips'), s.categories);
    categoriesRendered = true;
  }
  $('lobbyPlayers').innerHTML = playerChips(s.players.filter(p => p.connected));
  $('startBtn').disabled = !enough;
  $('status').textContent = enough
    ? `${connectedCount} players ready. Pick categories and start!`
    : `Waiting for players… (need at least ${s.minPlayers})`;
}

function renderSubmission(s) {
  show('submissionView');
  $('promptDisplay').textContent = s.prompt;
  $('status').textContent = `${s.submittedCount} / ${s.expectedCount} songs submitted`;
  $('submitPlayers').innerHTML = playerChips(s.players, 'submitted');
  $('voteBtn').disabled = s.submittedCount < 2;
}

function renderVoting(s) {
  show('votingView');
  $('promptDisplay').textContent = s.prompt;
  $('status').textContent = `Vote on your phone! ${s.votedCount} / ${s.expectedCount} votes in`;
  $('votingTracks').innerHTML = s.tracks.map(trackCard).join('');
  $('votePlayers').innerHTML = playerChips(s.players, 'voted');
}

function renderResults(s) {
  const r = s.results;
  show('resultsView');
  $('promptDisplay').textContent = r.prompt;
  $('status').textContent = r.winner.tie ? 'It\'s a tie! The record picked a winner:' : 'And the winner is…';

  $('winnerCard').innerHTML = `
    <img src="${esc(r.winner.track.albumArt)}" alt="">
    <div>
      <div class="w-name">${esc(r.winner.track.name)}</div>
      <div class="w-artist">${esc(r.winner.track.artist)}</div>
      <div class="w-by">Submitted by <strong style="color: var(--green);">${esc(r.winner.playerName)}</strong>
        — ${plural(r.winner.votes, 'vote')}</div>
    </div>`;

  $('tally').innerHTML = r.tally.map(t => `
    <div class="row">
      <span>${esc(t.track.name)} <small style="color: var(--muted);">— ${esc(t.playerName)}</small></span>
      <span class="pts">+${t.votes}</span>
    </div>`).join('');

  $('leaderboard').innerHTML = s.players
    .slice().sort((a, b) => b.points - a.points)
    .map((p, i) => `
      <div class="row${p.connected ? '' : ' offline'}">
        <span><strong>#${i + 1}</strong> ${esc(p.name)}</span>
        <span class="pts">${p.points} pts</span>
      </div>`).join('');
}

export function renderHost(s) {
  renderSpotifyStatus(s);
  $('roundBadge').textContent = s.round > 0 ? `Round ${s.round}` : '';

  if (s.state === 'LOBBY') renderLobby(s);
  else if (s.state === 'SUBMISSION') renderSubmission(s);
  else if (s.state === 'VOTING') renderVoting(s);
  else if (s.state === 'RESULTS' && s.results) renderResults(s);
}
