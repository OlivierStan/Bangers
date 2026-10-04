// Pushes the latest state to the host screens and players
const { room } = require('./state');
const { hostState, playerState } = require('./views');

let io = null;

function attach(ioInstance) {
  io = ioInstance;
}

function syncHosts() {
  io.to('hosts').emit('host-state', hostState());
}

function syncPlayer(playerId) {
  const player = room.players[playerId];
  if (player && player.socketId) {
    io.to(player.socketId).emit('player-state', playerState(playerId));
  }
}

function syncAll() {
  syncHosts();
  Object.keys(room.players).forEach(syncPlayer);
}

module.exports = { attach, syncHosts, syncPlayer, syncAll };
