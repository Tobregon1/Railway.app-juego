// client.js
const socket = io();

let questions = [];
let currentIndex = 0;
let selected = null;
let myName = "";

const status = document.getElementById('status');
const joinSection = document.getElementById('joinSection');
const quizSection = document.getElementById('quizSection');
const resultsSection = document.getElementById('resultsSection');

const nameInput = document.getElementById('nameInput');
const joinBtn = document.getElementById('joinBtn');

const questionBox = document.getElementById('questionBox');
const optionsBox = document.getElementById('optionsBox');
const nextBtn = document.getElementById('nextBtn');
const finishBtn = document.getElementById('finishBtn');
const feedback = document.getElementById('feedback');

const leaderList = document.getElementById('leaderList');
const yourResultDiv = document.getElementById('yourResult');
const resultsTableBody = document.querySelector('#resultsTable tbody');

joinBtn.addEventListener('click', () => {
  myName = nameInput.value.trim() || `User-${Math.random().toString(36).slice(2,7)}`;
  socket.emit('join', { name: myName });
  status.textContent = `Conectado como ${myName}`;
  joinSection.classList.add('hidden');
  quizSection.classList.remove('hidden');
});

socket.on('connect', () => status.textContent = 'Conectado al servidor');
socket.on('disconnect', () => status.textContent = 'Desconectado. Reconectando...');

socket.on('questions', (qs) => {
  questions = qs;
  currentIndex = 0;
  renderQuestion();
});

function renderQuestion() {
  selected = null;
  feedback.textContent = '';
  if (!questions || currentIndex >= questions.length) {
    // show finish button
    questionBox.textContent = 'Has terminado las preguntas. Pulsa Terminar para ver resultados.';
    optionsBox.innerHTML = '';
    nextBtn.classList.add('hidden');
    finishBtn.classList.remove('hidden');
    return;
  }
  const q = questions[currentIndex];
  questionBox.textContent = `${currentIndex+1}. ${q.q}`;
  optionsBox.innerHTML = '';
  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      // select
      selected = idx;
      Array.from(optionsBox.children).forEach(c => c.classList.remove('selected'));
      btn.classList.add('selected');
      nextBtn.classList.remove('hidden');
    });
    optionsBox.appendChild(btn);
  });
  nextBtn.classList.add('hidden');
  finishBtn.classList.add('hidden');
}

nextBtn.addEventListener('click', () => {
  if (selected === null) return;
  const q = questions[currentIndex];
  socket.emit('answer', { questionId: q.id, selectedIndex: selected });
  // optimistic UI
  feedback.textContent = 'Respuesta enviada';
  currentIndex++;
  setTimeout(renderQuestion, 300);
});

finishBtn.addEventListener('click', () => {
  socket.emit('finish');
});

socket.on('answerReceived', ({ questionId, correct, currentScore }) => {
  feedback.textContent = correct ? `Correcto! Puntos: ${currentScore}` : `Incorrecto. Puntos: ${currentScore}`;
});

socket.on('leaderboard', (list) => {
  leaderList.innerHTML = '';
  list.forEach(item => {
    const li = document.createElement('li');
    li.textContent = `${item.name} — ${item.score}`;
    leaderList.appendChild(li);
  });
});

socket.on('finalResults', ({ yourResult, allResults }) => {
  quizSection.classList.add('hidden');
  resultsSection.classList.remove('hidden');
  yourResultDiv.innerHTML = `<strong>${yourResult.name}</strong> — Puntaje: ${yourResult.score}`;
  // fill table
  resultsTableBody.innerHTML = '';
  allResults.sort((a,b) => b.score - a.score).forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.name}</td><td>${r.score}</td>`;
    resultsTableBody.appendChild(tr);
  });
});

// updates participants summary (not strictly necessary but helpful)
socket.on('participantsUpdate', (arr) => {
  // optional: show count in status
  const connectedCount = arr.length;
  status.textContent = `Conectado como ${myName || 'anónimo'} — ${connectedCount} participantes conectados`;
});
