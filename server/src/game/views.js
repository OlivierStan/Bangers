// What each client is allowed to see of the room state
const promptsData = require('../prompts');
const spotifyAuth = require('../spotify/auth');
const spotify = require('../spotify/api');
const { room, MIN_PLAYERS, expectedPlayerIds } = require('./state');

function hostState() {
  return {
    state: room.state,
    round: room.round,
    prompt: room.prompt,
    categories: Object.keys(promptsData),
    selectedCategories: room.categories,
    minPlayers: MIN_PLAYERS,
    players: Object.entries(room.players).map(([id, p]) => ({
      name: p.name,
      points: p.points,
      connected: !!p.socketId,
      submitted: room.submissions.some(s => s.playerId === id),
      voted: room.votes[id] !== undefined
    })),
    submittedCount: room.submissions.length,
    votedCount: Object.keys(room.votes).length,
    expectedCount: expectedPlayerIds().length,
    // In voting, show anonymous tracks on the big screen
    tracks: room.state === 'VOTING' ? room.submissions.map(s => s.track) : [],
    // Strip playerIds: they double as reconnect tokens
    results: room.state === 'RESULTS' && room.results
      ? { ...room.results, tally: room.results.tally.map(({ playerId, ...rest }) => rest) }
      : null,
    spotifyLoggedIn: spotifyAuth.isLoggedIn(),
    hasPlaybackDevice: spotify.hasHostDevice()
  };
}

function playerState(playerId) {
  const player = room.players[playerId];
  const base = { state: room.state, round: room.round, prompt: room.prompt, name: player.name, points: player.points };

  if (room.state === 'SUBMISSION') {
    const mine = room.submissions.find(s => s.playerId === playerId);
    return { ...base, submission: mine ? mine.track : null };
  }

  if (room.state === 'VOTING') {
    return {
      ...base,
      tracks: room.submissions.map((s, i) => ({ id: i, track: s.track, isOwn: s.playerId === playerId })),
      votedFor: room.votes[playerId] ?? null
    };
  }

  if (room.state === 'RESULTS' && room.results) {
    const mine = room.results.tally.find(t => t.playerId === playerId);
    const rank = 1 + Object.values(room.players).filter(p => p.points > player.points).length;
    return {
      ...base,
      winner: room.results.winner,
      myVotes: mine ? mine.votes : null,
      rank
    };
  }

  return base;
}

module.exports = { hostState, playerState };
