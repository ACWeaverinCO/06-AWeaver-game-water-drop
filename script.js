// Variables to control game state
let gameRunning = false;
let dropMaker = null;
let timerInterval = null;
let timeLeft = 0;
let score = 0;

// Difficulty configuration
const DIFFICULTY = {
  easy: {
    target: 20,
    time: 45,
    dropInterval: 800, // ms between drops
    dropDuration: 4500, // fall time in ms
    badChance: 0.12
  },
  normal: {
    target: 20,
    time: 30,
    dropInterval: 500,
    dropDuration: 4000,
    badChance: 0.25
  },
  hard: {
    target: 20,
    time: 25,
    dropInterval: 300,
    dropDuration: 3200,
    badChance: 0.40
  }
};


// Cache DOM nodes
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const targetEl = document.getElementById('target');
const difficultyEl = document.getElementById('difficulty');
const gameContainer = document.getElementById('game-container');
const messageEl = document.getElementById('game-message');

startBtn.addEventListener('click', startGame);
resetBtn.addEventListener('click', resetGame);

// --- Simple WebAudio helpers for short effects ---
let audioCtx = null;
function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playTone(freq, type = 'sine', duration = 0.12, gain = 0.12) {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(ctx.destination);
  const now = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  osc.start(now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.stop(now + duration + 0.02);
}

function playSuccessSound() {
  // layered tones for a pleasant pop
  playTone(1000, 'sine', 0.12, 0.09);
  setTimeout(() => playTone(1400, 'triangle', 0.08, 0.06), 30);
}

function playFailSound() {
  playTone(220, 'sawtooth', 0.18, 0.12);
  setTimeout(() => playTone(160, 'sine', 0.14, 0.08), 50);
}

function playStartSound() {
  playTone(440, 'sine', 0.12, 0.08);
  setTimeout(() => playTone(660, 'sine', 0.09, 0.06), 80);
}

function playEndSound(win) {
  if (win) {
    playTone(880, 'triangle', 0.18, 0.12);
    setTimeout(() => playTone(660, 'sine', 0.12, 0.08), 90);
  } else {
    playTone(200, 'sawtooth', 0.2, 0.12);
  }
}

function applyDifficultyUI() {
  const mode = difficultyEl.value;
  const cfg = DIFFICULTY[mode] || DIFFICULTY.normal;
  targetEl.textContent = cfg.target;
  timeEl.textContent = cfg.time;
}

// Initialize UI with default difficulty
applyDifficultyUI();
difficultyEl.addEventListener('change', () => {
  if (gameRunning) return; // prevent changes mid-game
  applyDifficultyUI();
});

function resetGame() {
  stopTimers();
  clearDrops();
  gameRunning = false;
  score = 0;
  scoreEl.textContent = score;
  // reset milestones for the next run
  shownMilestones.clear();
  const cfg = DIFFICULTY[difficultyEl.value] || DIFFICULTY.normal;
  timeLeft = cfg.time;
  timeEl.textContent = timeLeft;
  messageEl.style.display = 'none';
}

function startGame() {
  if (gameRunning) return;
  gameRunning = true;
  score = 0;
  scoreEl.textContent = score;
  // reset milestone tracking at start
  shownMilestones.clear();
  const cfg = DIFFICULTY[difficultyEl.value] || DIFFICULTY.normal;
  timeLeft = cfg.time;
  timeEl.textContent = timeLeft;
  messageEl.style.display = 'none';

  // play a start sound and then start the round once it finishes
  try { playStartSound(); } catch (e) { /* ignore audio errors */ }
  // ambient water sound when the game starts - wait for it to finish before making drops
  try {
    const audio = playSoundFile('img/water-191999.mp3');
    if (audio && typeof audio.play === 'function') {
      // If play() returns a promise, wait for it to resolve, otherwise wait for 'ended'
      const p = audio._playPromise;
      if (p) {
        p.then(() => startRound(cfg)).catch(() => startRound(cfg));
      } else {
        audio.addEventListener('ended', () => startRound(cfg));
        // fallback: if it doesn't end (e.g. loop), start immediately
        setTimeout(() => startRound(cfg), 800);
      }
    } else {
      // If playSoundFile didn't return audio, just start immediately
      startRound(cfg);
    }
  } catch (e) {
    // On any error, start immediately
    startRound(cfg);
  }
}

// Starts the actual timers and drop generation for a given config
function startRound(cfg) {
  // guard against multiple starts
  if (!gameRunning) return;
  // Countdown timer
  timerInterval = setInterval(() => {
    timeLeft--;
    timeEl.textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);

  // Drop maker
  dropMaker = setInterval(() => createDrop(cfg), cfg.dropInterval);
}

function endGame() {
  stopTimers();
  gameRunning = false;
  clearDrops();
  const cfg = DIFFICULTY[difficultyEl.value] || DIFFICULTY.normal;
  messageEl.style.display = 'block';
  if (score >= cfg.target) {
    messageEl.textContent = `🎉 Winner! You scored ${score}!`;
    showConfetti();
    try { playEndSound(true); } catch (e) {}
    // play the winner audio clip if available
    try { playSoundFile('img/winner-game-sound-404167.mp3'); } catch (e) {}
  } else {
    messageEl.textContent = `Try again! Score at least ${cfg.target} to win.`;
    try { playEndSound(false); } catch (e) {}
    // play the loss audio clip if available
    try { playSoundFile('img/game-over-417465.mp3'); } catch (e) {}
  }
  // append a random water-saving fun fact to the message
  const fact = randomWaterFact();
  const factEl = document.createElement('div');
  factEl.className = 'water-fact';
  factEl.textContent = `💧 Fun fact: ${fact}`;
  messageEl.appendChild(factEl);
  // add action buttons: Share, Donate, Play Again
  const actions = document.createElement('div');
  actions.className = 'message-actions';

  const shareBtn = document.createElement('button');
  shareBtn.className = 'btn share-btn';
  shareBtn.textContent = 'Share';
  shareBtn.addEventListener('click', async () => {
    const text = `${messageEl.textContent.trim()} — ${fact}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Water Drop Game', text }); } catch (e) { /* user cancelled or error */ }
    } else {
      // fallback to Twitter
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank', 'noopener');
    }
  });

  const donateBtn = document.createElement('button');
  donateBtn.className = 'btn donate-btn';
  donateBtn.textContent = 'Donate';
  donateBtn.addEventListener('click', () => {
    window.open('https://www.charitywater.org/donate', '_blank', 'noopener');
  });

  const againBtn = document.createElement('button');
  againBtn.className = 'btn again-btn';
  againBtn.textContent = 'Play Again';
  againBtn.addEventListener('click', () => {
    // hide message and restart game
    messageEl.style.display = 'none';
    messageEl.innerHTML = '';
    resetGame();
    startGame();
  });

  actions.appendChild(shareBtn);
  actions.appendChild(donateBtn);
  actions.appendChild(againBtn);
  messageEl.appendChild(actions);
}

// Play a short audio file by creating an <audio> element (non-blocking)
function playSoundFile(src) {
  try {
    const a = new Audio(src);
    // attempt to play, but capture the promise so callers can await it
    const p = a.play();
    a._playPromise = p instanceof Promise ? p : null;
    if (p && typeof p.catch === 'function') p.catch(() => {});
    // remove reference after it ends to help GC
    a.addEventListener('ended', () => { a.src = ''; });
    return a;
  } catch (e) {
    // ignore any errors creating/playing audio
    return null;
  }
}

// Small library of water-saving fun facts
const WATER_FACTS = [
  "Turning off the tap while brushing can save up to 8 gallons of water a day.",
  "Fixing a leaky faucet can save hundreds of gallons of water per year.",
  "A full dishwasher uses less water than hand-washing the same number of dishes.",
  "Shortening your shower by just 2 minutes can save up to 150 gallons per month.",
  "Watering plants early in the morning reduces evaporation and saves water.",
  "Collecting rainwater for garden use can significantly cut household water use.",
  "Modern low-flow showerheads can reduce water usage by over 40% without sacrificing pressure."
];

function randomWaterFact() {
  return WATER_FACTS[Math.floor(Math.random() * WATER_FACTS.length)];
}

function stopTimers() {
  if (dropMaker) {
    clearInterval(dropMaker);
    dropMaker = null;
  }
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function clearDrops() {
  // Remove dynamic children (drops, particles, confetti) but keep static UI like #game-message
  const children = Array.from(gameContainer.children);
  for (const child of children) {
    if (child.id === 'game-message') continue;
    gameContainer.removeChild(child);
  }
}

function createDrop(cfg) {
  // Randomly decide if this is a good drop or a bad drop
  const isBadDrop = Math.random() < cfg.badChance;
  const drop = document.createElement('div');
  // Use class names that match the stylesheet: good-drop and bad-drop
  drop.className = isBadDrop ? 'bad-drop' : 'good-drop';

  // Size variation
  const initialSize = 60;
  const sizeMultiplier = Math.random() * 0.8 + 0.5;
  const size = initialSize * sizeMultiplier;
  drop.style.width = drop.style.height = `${size}px`;

  // Position the drop randomly across the game width
  const gameWidth = gameContainer.offsetWidth;
  const xPosition = Math.random() * Math.max(0, gameWidth - size);
  drop.style.left = `${xPosition}px`;
  // Ensure drop starts at the top of the container so dropFall can translateY from -100px -> 600px
  drop.style.top = '0px';
  // hint to browser that transform will change for better performance
  drop.style.willChange = 'transform';

  // Animate fall
  const durationSec = cfg.dropDuration / 1000;
  // set CSS variable used by styles so multi-animation rules pick up right duration
  drop.style.setProperty('--fall-duration', `${durationSec}s`);
  // also set a primary animationDuration as a fallback for older browsers
  drop.style.animationDuration = `${durationSec}s`;

  gameContainer.appendChild(drop);

  let clicked = false;
  drop.addEventListener('click', () => {
    if (clicked) return;
    clicked = true;
    if (isBadDrop) {
      score = Math.max(0, score - 1);
      drop.classList.add('bad-explode');
      try { playFailSound(); } catch (e) {}
    } else {
        score++;
        // spawn particles and bounce the drop for a stronger effect
        try { spawnParticles(drop, 8); } catch (e) {}
        try { drop.classList.add('bounce'); } catch (e) {}
        // remove bounce after animation so explode can run
        setTimeout(() => drop.classList.remove('bounce'), 160);
        drop.classList.add('explode');
        try { playSuccessSound(); } catch (e) {}
    }
  scoreEl.textContent = score;
  try { checkAndShowMilestone(score); } catch (e) { /* ignore */ }
    // Stop the falling animation so the explode animation is visible
    try { drop.style.animation = 'none'; } catch (e) {}
    // Ensure the drop is removed after its explode animation finishes.
    // There is an 'animationend' listener below that will remove it, but
    // use a small fallback in case the event doesn't fire.
    setTimeout(() => { if (drop.parentElement) drop.remove(); }, 700);
  });

  // Cleanup when animation ends
 drop.addEventListener('animationend', (e) => {
  // Only remove after the fall animation ends, not shimmer or other effects
  if (e.animationName === 'dropFall' && drop.parentElement) {
    drop.remove();
  }
});
}

// Spawn a small burst of colored particles at the drop's center
function spawnParticles(dropEl, count = 6) {
  const rect = dropEl.getBoundingClientRect();
  const containerRect = gameContainer.getBoundingClientRect();
  const cx = rect.left + rect.width / 2 - containerRect.left;
  const cy = rect.top + rect.height / 2 - containerRect.top;
  // read palette from CSS variables for a brand-consistent burst
  const rootStyle = getComputedStyle(document.documentElement);
  const colors = [
    rootStyle.getPropertyValue('--cw-yellow').trim() || '#FFC907',
    rootStyle.getPropertyValue('--cw-blue').trim() || '#2E9DF7',
    rootStyle.getPropertyValue('--cw-light-blue').trim() || '#8BD1CB',
    rootStyle.getPropertyValue('--cw-green').trim() || '#4FCB53',
    rootStyle.getPropertyValue('--cw-orange').trim() || '#FF902A'
  ];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = `${cx - 4 + (Math.random() - 0.5) * 8}px`;
    p.style.top = `${cy - 4 + (Math.random() - 0.5) * 8}px`;
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    const angle = Math.random() * Math.PI * 2;
    const dist = 24 + Math.random() * 34;
    const dx = Math.cos(angle) * dist + 'px';
    const dy = -(Math.sin(angle) * dist) + 'px';
    p.style.setProperty('--dx', dx);
    p.style.setProperty('--dy', dy);
    p.style.setProperty('--rot', (Math.random() * 360) + 'deg');
    gameContainer.appendChild(p);
    // cleanup after animation
    setTimeout(() => { if (p.parentElement) p.remove(); }, 800);
  }
}

function showConfetti() {
  for (let i = 0; i < 40; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * (gameContainer.offsetWidth - 12) + 'px';
    // use CSS variables for confetti color selection
    confetti.style.background = confettiColor();
    confetti.style.top = '-30px';
    gameContainer.appendChild(confetti);
    setTimeout(() => confetti.remove(), 1500);
  }
}

function confettiColor() {
  const rootStyle = getComputedStyle(document.documentElement);
  const palette = [
    rootStyle.getPropertyValue('--cw-yellow').trim() || '#FFC907',
    rootStyle.getPropertyValue('--cw-blue').trim() || '#2E9DF7',
    rootStyle.getPropertyValue('--cw-light-blue').trim() || '#8BD1CB',
    rootStyle.getPropertyValue('--cw-green').trim() || '#4FCB53',
    rootStyle.getPropertyValue('--cw-orange').trim() || '#FF902A',
    rootStyle.getPropertyValue('--cw-red').trim() || '#F5402C',
    rootStyle.getPropertyValue('--cw-dark-green').trim() || '#159A48',
    rootStyle.getPropertyValue('--cw-pink').trim() || '#F16061'
  ];
  return palette[Math.floor(Math.random() * palette.length)];
}

// Ensure message area is hidden initially
messageEl.style.display = 'none';

// Milestone messages: percentage thresholds mapped to messages
const MILESTONES = [
  {score: 1, message: "Nice start!"},
  {score: 5, message: "Getting warmed up!"},
  {score: 10, message: "Halfway there!"},
  {score: 15, message: "So close!"},
  {score: 20, message: "Target reached!"}
];

// Track which milestone indices we've already shown during current run
let shownMilestones = new Set();

function showMilestoneToast(text) {
  // create a transient toast inside the game container
  const t = document.createElement('div');
  t.className = 'milestone-toast';
  t.textContent = text;
  gameContainer.appendChild(t);
  // auto-hide after 2s
  setTimeout(() => { t.classList.add('hide'); }, 1700);
  setTimeout(() => { if (t.parentElement) t.remove(); }, 2200);
}

function checkAndShowMilestone(currentScore) {
  // Find milestones that match this exact score and haven't been shown
  for (let i = 0; i < MILESTONES.length; i++) {
    const m = MILESTONES[i];
    if (currentScore >= m.score && !shownMilestones.has(i)) {
      shownMilestones.add(i);
      try { showMilestoneToast(m.message); } catch (e) { /* ignore */ }
    }
  }
}
