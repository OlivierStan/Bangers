// Song search box on the guest phone
import { $, esc } from '../shared/utils.js';

let socket = null;
let onPick = null;
let timeout = null;

export function songCard(track, extraClass = '', tag = '') {
  const card = document.createElement('div');
  card.className = 'song-card ' + extraClass;
  card.innerHTML = `
    <img src="${esc(track.albumArt)}" alt="" />
    <div class="song-info">
      <div class="song-title">${esc(track.name)}</div>
      <div class="song-artist">${esc(track.artist)}</div>
    </div>
    ${tag ? `<span class="tag">${esc(tag)}</span>` : ''}
  `;
  return card;
}

export function clearSearch() {
  $('searchInput').value = '';
  $('results').innerHTML = '';
}

export function initSearch(socketInstance, onPickTrack) {
  socket = socketInstance;
  onPick = onPickTrack;
  const searchInput = $('searchInput');
  const resultsContainer = $('results');

  searchInput.addEventListener('input', () => {
    clearTimeout(timeout);
    const query = searchInput.value.trim();

    if (query.length < 2) {
      resultsContainer.innerHTML = '';
      return;
    }

    timeout = setTimeout(() => {
      resultsContainer.innerHTML = '<p>Searching…</p>';
      socket.emit('search-song', { query });
    }, 300);
  });

  socket.on('search-results', ({ query, tracks }) => {
    // Ignore stale responses from an older search
    if (query.trim() !== searchInput.value.trim()) return;
    resultsContainer.innerHTML = '';

    if (!tracks || tracks.length === 0) {
      resultsContainer.innerHTML = '<p>No songs found.</p>';
      return;
    }

    tracks.forEach(track => {
      const card = songCard(track);
      card.onclick = () => onPick(track);
      resultsContainer.appendChild(card);
    });
  });
}
