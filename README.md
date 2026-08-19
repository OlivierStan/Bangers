# Bangers

An interactive, real-time arcade party game connecting a Unity 3D Host screen 
with mobile browsers via WebSockets and the Spotify Web API.

## Visual Preview

## Architecture Overview
- **Host Screen (Unity C#):** Renders 3D visuals, audio spectrum analysis, and QR code.
- **Backend (Node.js + Socket.io):** Handles room state, voting math, and Spotify API queries.
- **Guest UI (Mobile Web):** Lightweight HTML/JS mobile interface for searching and voting.

## Tech Stack
- **Engine:** Unity (C#)
- **Networking:** Node.js, Express, Socket.io
- **APIs:** Spotify Web API (Client Credentials Flow)

## Quick Start / Local Setup
1. Clone the repository: `git clone https://github.com/OlivierStan/Bangers.git`
2. Install server dependencies: `cd server && npm install`
3. Add your Spotify API keys to `.env`
4. Run the server: `npm start`
5. Open the Unity project and press **Play**!
