# Bangers

A real-time party game: a host screen shows a QR code, players join on their phones,
pick a Spotify song that fits each prompt, vote on each other's picks, and the winning
song plays on the big screen.

## Architecture Overview
The server owns the game state and pushes it to every screen, so refreshing or reconnecting picks up where you left off.

```
server/
  index.js                  Boots Express + HTTPS + Socket.io
  src/
    prompts.js              Prompt categories (add a key to add a category)
    routes.js               Spotify login routes (/login, /callback, /host-token)
    sockets.js              Socket.io event handlers
    game/
      state.js              Room state + helpers
      views.js              What the host / each player is allowed to see
      sync.js               Pushes state to clients
      flow.js               Rounds, voting, scoring, auto-advance
    spotify/
      auth.js               Host login (OAuth PKCE)
      api.js                Track search + playback on the host
  public/
    host.html               Big screen (markup only)
    index.html              Guest phone (markup only)
    css/                    host.css, guest.css
    js/shared/utils.js      Helpers used by both pages
    js/host/                main.js (entry), render.js, categories.js, background.js (Three.js), spotify-player.js
    js/guest/               main.js (entry), render.js, search.js
```

The browser code uses native ES modules (`<script type="module">`), so there's no build step.

## Game Flow
1. Host opens `/host.html`, logs in with Spotify (Premium needed for playback) and picks categories.
2. Players scan the QR code and enter their name (at least 2 players).
3. Each round, players submit a song for the prompt. Voting starts automatically once everyone submitted (or the host can force it).
4. Players vote for their favourite (not their own). Results show automatically once everyone voted.
5. Every vote is 1 point; the winning song plays on the host.

## Quick Start / Local Setup
1. Clone the repository: `git clone https://github.com/OlivierStan/Bangers.git`
2. Install server dependencies: `cd server && npm install`
3. Create `server/.env` with `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and `SPOTIFY_REDIRECT_URI`
4. Run the server: `npm start`
5. Open `https://127.0.0.1:3000/host.html` on the host PC

To let phones join from outside your network, tunnel it with ngrok (`ngrok http https://127.0.0.1:3000`)
and set `SPOTIFY_REDIRECT_URI` to `https://<your-ngrok-domain>/callback` (also add it in the Spotify dashboard).
