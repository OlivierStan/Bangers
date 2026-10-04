const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const { Server } = require('socket.io');
const fs = require('fs');
const https = require('https');
const routes = require('./src/routes');
const registerSockets = require('./src/sockets');
const spotify = require('./src/spotify/api');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(routes);

const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'localhost+1-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'localhost+1.pem'))
};

const server = https.createServer(sslOptions, app);
const io = new Server(server, { cors: { origin: "*" } });

registerSockets(io);
spotify.startTokenRefresh();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on https://127.0.0.1:${PORT}`);
});
