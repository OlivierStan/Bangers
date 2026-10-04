// Round lifecycle: LOBBY -> SUBMISSION -> VOTING -> RESULTS -> SUBMISSION ...
const spotify = require('../spotify/api');
const { syncAll } = require('./sync');
const { room, shuffleArray, buildPromptList, expectedPlayerIds, sortedScores } = require('./state');

function startRound(isFirstRound, categories) {
  if (isFirstRound || room.activePrompts.length === 0) {
    const built = buildPromptList(categories);
    room.categories = built.categories;
    room.activePrompts = built.prompts;
    room.currentPromptIndex = 0;
  } else {
    room.currentPromptIndex++;
    // Ran out of prompts: reshuffle and go again
    if (room.currentPromptIndex >= room.activePrompts.length) {
      shuffleArray(room.activePrompts);
      room.currentPromptIndex = 0;
    }
  }

  room.round++;
  room.prompt = room.activePrompts[room.currentPromptIndex];
  room.submissions = [];
  room.votes = {};
  room.results = null;
  room.state = "SUBMISSION";

  console.log(`Round ${room.round} started with prompt: "${room.prompt}"`);
  syncAll();
}

function startVoting() {
  if (room.state !== 'SUBMISSION' || room.submissions.length < 2) return;

  // Shuffle so the order doesn't reveal who submitted first
  shuffleArray(room.submissions);
  room.votes = {};
  room.state = 'VOTING';

  console.log('Voting phase started.');
  syncAll();
}

function endVoting() {
  if (room.state !== 'VOTING') return;

  const voteCounts = room.submissions.map(() => 0);
  Object.values(room.votes).forEach(index => { voteCounts[index]++; });

  // Award 1 point per vote received
  room.submissions.forEach((s, i) => {
    if (room.players[s.playerId]) room.players[s.playerId].points += voteCounts[i];
  });

  // Winner: highest votes, random pick among ties
  const maxVotes = Math.max(...voteCounts);
  const tied = voteCounts.map((c, i) => c === maxVotes ? i : -1).filter(i => i !== -1);
  const winnerIndex = tied[Math.floor(Math.random() * tied.length)];
  const winnerSubmission = room.submissions[winnerIndex];

  const tally = room.submissions.map((s, i) => ({
    playerId: s.playerId,
    playerName: room.players[s.playerId]?.name || 'Unknown',
    track: s.track,
    votes: voteCounts[i]
  })).sort((a, b) => b.votes - a.votes);

  room.results = {
    prompt: room.prompt,
    winner: {
      track: winnerSubmission.track,
      playerName: room.players[winnerSubmission.playerId]?.name || 'Unknown',
      votes: maxVotes,
      tie: tied.length > 1
    },
    tally,
    scores: sortedScores()
  };
  room.state = 'RESULTS';

  spotify.playTrackOnHost(winnerSubmission.track.id);

  console.log(`Voting ended. Winner: ${winnerSubmission.track.name}`);
  syncAll();
}

// Move on automatically once every connected player has acted
function checkAutoAdvance() {
  const expected = expectedPlayerIds();
  if (expected.length === 0) return;

  if (room.state === 'SUBMISSION') {
    const allSubmitted = expected.every(id => room.submissions.some(s => s.playerId === id));
    if (allSubmitted && room.submissions.length >= 2) startVoting();
  } else if (room.state === 'VOTING') {
    const allVoted = expected.every(id => room.votes[id] !== undefined);
    if (allVoted) endVoting();
  }
}

function resetGame() {
  room.state = 'LOBBY';
  room.round = 0;
  room.prompt = null;
  room.activePrompts = [];
  room.currentPromptIndex = 0;
  room.submissions = [];
  room.votes = {};
  room.results = null;
  // Drop players that left, reset scores for the rest
  Object.keys(room.players).forEach(id => {
    if (!room.players[id].socketId) delete room.players[id];
    else room.players[id].points = 0;
  });
  syncAll();
}

module.exports = { startRound, startVoting, endVoting, checkAutoAdvance, resetGame };
