// Variables to control game state
let gameRunning = false; // Keeps track of whether game is active or not
let dropMaker; // Will store our timer that creates drops regularly
let timerInterval; // Will store our timer countdown interval
let timeLeft = 30; // Track time left in seconds
let score = 0; // Track the player's score
// Wait for button click to start the game
document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("reset-btn").addEventListener("click", resetGame);
function resetGame() {
  // Stop drop creation and timer
  clearInterval(dropMaker);
  clearInterval(timerInterval);
  gameRunning = false;
  // Remove all drops
  const container = document.getElementById("game-container");
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  // Reset score
  score = 0;
  document.getElementById("score").textContent = score;
  // Reset timer
  timeLeft = 30;
  document.getElementById("time").textContent = timeLeft;
}
function startGame() {
  // Prevent multiple games from running at once
  if (gameRunning) return;
  gameRunning = true;
  // Reset score and timer at the start of the game
  score = 0;
  document.getElementById("score").textContent = score;
  timeLeft = 30;
  document.getElementById("time").textContent = timeLeft;
  // Start timer countdown
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById("time").textContent = timeLeft;
    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
  // Create new drops every second (1000 milliseconds)
  dropMaker = setInterval(createDrop, 500);
function endGame() {
  clearInterval(dropMaker);
  clearInterval(timerInterval);
  gameRunning = false;
  // Remove all drops
  const container = document.getElementById("game-container");
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  // Show message and confetti if winner
  const msgDiv = document.getElementById("game-message");
  msgDiv.style.display = "block";
  if (score > 19) {
    msgDiv.textContent = "🎉 Winner! You scored " + score + "!";
    showConfetti();
  } else {
    msgDiv.textContent = "Try again! Score at least 20 to win.";
  }
}
function showConfetti() {
  const container = document.getElementById("game-container");
  for (let i = 0; i < 40; i++) {
    const confetti = document.createElement("div");
    confetti.className = "confetti";
    confetti.style.left = Math.random() * 780 + "px";
    confetti.style.background = confettiColor();
    confetti.style.top = "-30px";
    container.appendChild(confetti);
    setTimeout(() => confetti.remove(), 1300);
  }
}
function confettiColor() {
  const colors = ["#FFC907", "#2E9DF7", "#8BD1CB", "#4FCB53", "#FF902A", "#F5402C", "#159A48", "#F16061"];
  return colors[Math.floor(Math.random() * colors.length)];
}
  // Hide message
  document.getElementById("game-message").style.display = "none";
}
function createDrop() {
  // Randomly decide if this is a good drop or a bad drop
  const isBadDrop = Math.random() < 0.25; // 25% chance for bad drop
  const drop = document.createElement("div");
  drop.className = isBadDrop ? "water-drop bad-drop" : "water-drop";
  // Make drops different sizes for visual variety
  const initialSize = 60;
  const sizeMultiplier = Math.random() * 0.8 + 0.5;
  const size = initialSize * sizeMultiplier;
  drop.style.width = drop.style.height = `${size}px`;
  // Position the drop randomly across the game width
  // Subtract 60 pixels to keep drops fully inside the container
  const gameWidth = document.getElementById("game-container").offsetWidth;
  const xPosition = Math.random() * (gameWidth - 60);
  drop.style.left = xPosition + "px";
  // Make drops fall for 4 seconds
  drop.style.animationDuration = "4s";
  // Add the new drop to the game screen
  document.getElementById("game-container").appendChild(drop);
  // When a drop is clicked, only allow one score change per drop
  let clicked = false;
  drop.addEventListener("click", () => {
    if (clicked) return;
    clicked = true;
    if (isBadDrop) {
      score = Math.max(0, score - 1);
      drop.classList.add("bad-explode");
    } else {
      score++;
      drop.classList.add("explode");
    }
    document.getElementById("score").textContent = score;
    // Remove drop immediately on click
    drop.remove();
  });
  // Remove drops that reach the bottom (weren't clicked)
  drop.addEventListener("animationend", () => {
    drop.remove(); // Clean up drops that weren't caught
  });
}
