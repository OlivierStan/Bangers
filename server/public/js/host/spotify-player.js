// Spotify Web Playback SDK: turns the host browser into a Spotify device the server can play on

let player = null;
let sdkReady = false;
let socket = null;
let loggedIn = false;

export function initSpotify(socketInstance) {
  socket = socketInstance;

  // The SDK calls this global once it has loaded, so define it before loading the script
  window.onSpotifyWebPlaybackSDKReady = () => {
    sdkReady = true;
    createPlayer();
  };

  const script = document.createElement('script');
  script.src = 'https://sdk.scdn.co/spotify-player.js';
  document.body.appendChild(script);
}

// Called on every state update; the player is only created once the host has logged in
export function setLoggedIn(value) {
  loggedIn = value;
  createPlayer();
}

// Browsers block audio until the user interacts with the page, so call this on host clicks
export function unlockAudio() {
  if (player && player.activateElement) player.activateElement();
}

function createPlayer() {
  if (player || !sdkReady || !loggedIn) return;

  player = new Spotify.Player({
    name: 'Bangers Host Player',
    getOAuthToken: cb => {
      fetch('/host-token')
        .then(res => res.json())
        .then(data => {
          if (data.accessToken) cb(data.accessToken);
          else console.warn('Host not logged in to Spotify.');
        })
        .catch(err => console.error('Token fetch error:', err));
    },
    volume: 0.8
  });

  // When ready, send device ID to Node server
  player.addListener('ready', ({ device_id }) => {
    console.log('Spotify Host Player Ready with Device ID:', device_id);
    socket.emit('host-device-ready', device_id);
  });

  player.addListener('not_ready', ({ device_id }) => {
    console.log('Device ID has gone offline', device_id);
  });

  ['initialization_error', 'authentication_error', 'account_error', 'playback_error'].forEach(evt => {
    player.addListener(evt, ({ message }) => {
      console.error(`Spotify ${evt}:`, message);
      if (evt === 'account_error') {
        document.getElementById('spotifyStatus').textContent = '⚠️ Spotify Premium is required for playback';
      }
    });
  });

  player.connect();
}
