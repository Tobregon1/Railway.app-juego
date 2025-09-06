// index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// --- Quiz configuration (edítalo aquí) ---
const questions = [
  {
    id: 1,
    q: "¿Cuál es la capital de Argentina?",
    options: ["Lima", "Buenos Aires", "Santiago", "Montevideo"],
    answerIndex: 1
  },
  {
    id: 2,
    q: "¿En qué año llegó el hombre a la Luna?",
    options: ["1965", "1969", "1972", "1962"],
    answerIndex: 1
  },
  {
    id: 3,
    q: "¿Cuál es el lenguaje principal para desarrollo web front-end?",
    options: ["Python", "C++", "JavaScript", "Ruby"],
    answerIndex: 2
  }
];
// -------------------------------------------

// In-memory store (demo). Para producción usar DB.
const participants = {}; // socketId -> { name, score, answers: [{qid, selected, correct}] }
const summary = []; // array of results for finished participants

io.on('connection', (socket) => {
  console.log('nuevo cliente:', socket.id);

  // When client joins, send questions (without correct indexes).
  socket.on('join', (payload) => {
    const name = (payload && payload.name) ? payload.name : `User-${socket.id.slice(0,5)}`;
    participants[socket.id] = { name, score: 0, answers: [], finished: false, connectedAt: Date.now() };
    // send questions without the answerIndex
    const safeQuestions = questions.map(q => ({ id: q.id, q: q.q, options: q.options }));
    socket.emit('questions', safeQuestions);
    io.emit('participantsUpdate', getParticipantsSummary());
  });

  socket.on('answer', ({ questionId, selectedIndex }) => {
    const p = participants[socket.id];
    if (!p || p.finished) return;
    const q = questions.find(x => x.id === questionId);
    if (!q) return;
    const correct = (selectedIndex === q.answerIndex);
    if (correct) p.score += 1;
    p.answers.push({ questionId, selectedIndex, correct });
    // Optionally emit progress to this user
    socket.emit('answerReceived', { questionId, correct, currentScore: p.score });
    // Broadcast leaderboard updates (top 10)
    io.emit('leaderboard', getLeaderboard());
  });

  socket.on('finish', () => {
    const p = participants[socket.id];
    if (!p || p.finished) return;
    p.finished = true;
    summary.push({ name: p.name, score: p.score, answers: p.answers, finishedAt: Date.now() });
    // Send the final results array to this client
    socket.emit('finalResults', { yourResult: { name: p.name, score: p.score, answers: p.answers }, allResults: summary });
    // Broadcast updated participants and leaderboard
    io.emit('participantsUpdate', getParticipantsSummary());
    io.emit('leaderboard', getLeaderboard());
  });

  socket.on('disconnect', () => {
    console.log('desconectado:', socket.id);
    // Keep the record but mark disconnected (optional). For demo remove:
    if (participants[socket.id]) {
      participants[socket.id].disconnectedAt = Date.now();
      // don't delete so data remains for finalization
    }
    io.emit('participantsUpdate', getParticipantsSummary());
  });

  // Admin endpoint: request current all results
  socket.on('requestAllResults', () => {
    socket.emit('allResults', summary);
  });
});

function getParticipantsSummary() {
  return Object.entries(participants).map(([id,p]) => ({
    id,
    name: p.name,
    score: p.score,
    finished: p.finished,
    connectedAt: p.connectedAt,
    answersCount: p.answers.length
  }));
}

function getLeaderboard() {
  // return sorted top by score, then by earliest finish time
  const arr = Object.values(participants).map(p => ({ name: p.name, score: p.score, finished: p.finished }));
  arr.sort((a,b) => b.score - a.score);
  return arr.slice(0, 20);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
