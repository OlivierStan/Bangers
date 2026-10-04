// Small helpers used by both the host screen and the guest phone

export const $ = id => document.getElementById(id);

// Escape text before putting it into innerHTML (player names, song titles, ...)
export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// localStorage can throw in private mode, so never let it break the page
export function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

export function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}
