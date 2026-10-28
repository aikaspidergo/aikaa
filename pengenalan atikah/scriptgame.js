// ================= AMBIL ELEMEN =================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const intro = document.getElementById("intro");
const nameScreen = document.getElementById("nameScreen");
const gameMenu = document.getElementById("gameMenu");
const hud = document.getElementById("hud");
const gameOver = document.getElementById("gameOver");
const messageScreen = document.getElementById("messageScreen");
const bgm = document.getElementById("bgm");
const gameVideo = document.getElementById("gameVideo");
const hitFlash = document.getElementById("hitFlash");
const muteBtn = document.getElementById("muteBtn");

let playerName = "";
let invincible = false;
let mode = "box";
let gameRunning = false;

// ================= FITUR MUTE =================
let isMuted = false;

// ================= FITUR LEVEL =================
let currentLevel = 1;
let maxLevel = 100;
let flagsForNextLevel = 3;

// ================= FUNGSI NAMA =================
function showNameInput() {
  intro.style.display = "none";
  nameScreen.style.display = "flex";
  
  const nameVideo = document.getElementById("nameBgVideo");
  if(nameVideo) nameVideo.play();
}

function startGameWithName() {
  let input = document.getElementById("playerNameInput").value.trim();
  
  if (input === "") {
    alert("Isi nama dulu ya! ✨");
    return;
  }
  
  playerName = input;
  nameScreen.style.display = "none";
  gameMenu.style.display = "flex";
}

document.getElementById("playerNameInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") startGameWithName();
});

// ================= FUNGSI MUTE =================
function toggleMute() {
  isMuted = !isMuted;
  
  if (bgm) {
    if (isMuted) {
      bgm.pause();
      muteBtn.innerHTML = "🔇";
    } else {
      bgm.play().catch(() => {});
      muteBtn.innerHTML = "🔊";
    }
  }
}

if (muteBtn) {
  muteBtn.addEventListener("click", toggleMute);
}

// Fungsi play sound efek
function playSound(type) {
  if (isMuted) return;
  
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    gainNode.gain.value = 0.2;
    
    if (type === "collect") {
      oscillator.frequency.value = 880;
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
    } else if (type === "hit") {
      oscillator.frequency.value = 220;
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.3);
    } else if (type === "levelup") {
      oscillator.frequency.value = 440;
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.8);
    } else if (type === "win") {
      oscillator.frequency.value = 660;
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 1);
    }
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);
  } catch(e) {
    if (type === "hit" && navigator.vibrate) navigator.vibrate(200);
  }
}

// ================= FUNGSI GETAR =================
function vibrate(pattern) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

// ================= MULAI GAME =================
function startBoxGame() {
  mode = "box";
  gameMenu.style.display = "none";
  startGame();
}

function startMazeGame() {
  mode = "maze";
  gameMenu.style.display = "none";
  startGame();
}

// ================= DATA KUIS =================
let quizQuestions = [
  {
    question: "Siapa nama lengkap Aika?",
    options: ["Aikah", "Aikaika", "Aikaimut", "shine"],
    correct: 0,
    fact: "Atikah adalah nama lengkapnya! 💖"
  },
  {
    question: "Apa hobi Aika?",
    options: ["menjadi plenger", "tidur", "bergosip", "ngejurnal"],
    correct: 1,
    fact: "Aika suka banget tidur di sekolah"
  },
  {
    question: "Warna favorit Aika adalah...",
    options: ["Biru", "Hijau", "Pink", "Kuning"],
    correct: 2,
    fact: "Pink adalah warna favorit Aika! 🩷"
  },
  {
    question: "Aika punya teman roblox namanya...",
    options: ["aury", "aik", "ahay", "senja"],
    correct: 0,
    fact: "aury adalah teman roblox aika"
  },
  {
    question: "Apa yang paling Aika sukai?",
    options: ["game", "tidur", "melihat warna pink", "Semua benar"],
    correct: 3,
    fact: "Aika suka semuanya! Dia orangnya serba bisa ✨"
  }
];

let currentQuestionIndex = 0;
let quizScore = 0;
let quizAnswered = false;
let quizActive = false;

// ================= FUNGSI START KUIS =================
function startQuizGame() {
  mode = "quiz";
  gameMenu.style.display = "none";
  
  currentQuestionIndex = 0;
  quizScore = 0;
  quizAnswered = false;
  quizActive = true;
  
  canvas.style.display = "none";
  hud.style.display = "none";
  if (gameVideo) gameVideo.style.display = "none";
  
  const quizScreen = document.getElementById("quizScreen");
  if (!quizScreen) {
    createQuizScreen();
  } else {
    quizScreen.style.display = "flex";
  }
  
  displayQuestion();
  
  if (bgm) bgm.pause();
}

// ================= BUAT LAYAR KUIS =================
function createQuizScreen() {
  const quizScreen = document.createElement("div");
  quizScreen.id = "quizScreen";
  quizScreen.innerHTML = `
    <button class="quiz-close" onclick="closeQuiz()">✖</button>
    <div class="quiz-container">
      <div class="quiz-header">
        <span>❓ KUIS AIKA</span>
        <span id="quizCounter">Soal 1/${quizQuestions.length}</span>
      </div>
      <div class="quiz-question" id="quizQuestion">Loading...</div>
      <div class="quiz-options" id="quizOptions"></div>
      <button class="quiz-next" id="quizNextBtn" onclick="nextQuestion()" disabled>➡ NEXT</button>
      <div id="quizResult" class="quiz-result"></div>
    </div>
  `;
  document.body.appendChild(quizScreen);
  quizScreen.style.display = "flex";
}

// ================= TAMPILKAN SOAL =================
function displayQuestion() {
  if (!quizActive) return;
  
  const question = quizQuestions[currentQuestionIndex];
  document.getElementById("quizQuestion").innerHTML = question.question;
  document.getElementById("quizCounter").innerHTML = `Soal ${currentQuestionIndex + 1}/${quizQuestions.length}`;
  
  const optionsContainer = document.getElementById("quizOptions");
  optionsContainer.innerHTML = "";
  
  question.options.forEach((opt, idx) => {
    const optionDiv = document.createElement("div");
    optionDiv.className = "quiz-option";
    optionDiv.innerHTML = `${String.fromCharCode(65 + idx)}. ${opt}`;
    optionDiv.onclick = () => checkAnswer(idx);
    optionsContainer.appendChild(optionDiv);
  });
  
  quizAnswered = false;
  document.getElementById("quizNextBtn").disabled = true;
  document.getElementById("quizResult").innerHTML = "";
  
  document.querySelectorAll(".quiz-option").forEach(opt => {
    opt.classList.remove("correct", "wrong");
  });
}

// ================= CEK JAWABAN =================
function checkAnswer(selectedIndex) {
  if (quizAnswered) return;
  
  quizAnswered = true;
  const question = quizQuestions[currentQuestionIndex];
  const isCorrect = (selectedIndex === question.correct);
  const optionsDiv = document.querySelectorAll(".quiz-option");
  const resultDiv = document.getElementById("quizResult");
  
  if (isCorrect) {
    quizScore++;
    optionsDiv[selectedIndex].classList.add("correct");
    resultDiv.innerHTML = `✅ BENAR! ${question.fact}`;
    resultDiv.style.background = "rgba(0,255,0,0.2)";
    resultDiv.style.color = "#aaffaa";
    playSound("collect");
    vibrate(50);
  } else {
    optionsDiv[selectedIndex].classList.add("wrong");
    optionsDiv[question.correct].classList.add("correct");
    resultDiv.innerHTML = `❌ SALAH! Jawaban benar: ${question.options[question.correct]}<br>📝 ${question.fact}`;
    resultDiv.style.background = "rgba(255,0,0,0.2)";
    resultDiv.style.color = "#ffaaaa";
    playSound("hit");
    vibrate(100);
  }
  
  document.getElementById("quizNextBtn").disabled = false;
}

// ================= SOAL BERIKUTNYA =================
function nextQuestion() {
  if (!quizAnswered) return;
  
  currentQuestionIndex++;
  
  if (currentQuestionIndex < quizQuestions.length) {
    displayQuestion();
  } else {
    finishQuiz();
  }
}

// ================= SELESAI KUIS =================
function finishQuiz() {
  quizActive = false;
  const total = quizQuestions.length;
  const percentage = (quizScore / total) * 100;
  
  let message = "";
  let grade = "";
  
  if (percentage === 100) {
    message = "🎉 SEMPURNA! Kamu benar-benar mengenal Aika! 🎉";
    grade = "🏆 SANGAT BAIK!";
    playSound("win");
    vibrate([200, 100, 200]);
  } else if (percentage >= 80) {
    message = "⭐ HEBAT! Kamu cukup mengenal Aika! ⭐";
    grade = "✨ BAIK SEKALI! ✨";
    playSound("levelup");
    vibrate([100, 50, 100]);
  } else if (percentage >= 60) {
    message = "📚 Belajar lagi yuk biar lebih kenal Aika! 📚";
    grade = "👍 CUKUP!";
    playSound("collect");
  } else {
    message = "🌸 Jangan sedih! Sekarang kamu jadi lebih tahu tentang Aika! 🌸";
    grade = "💪 TERUS BELAJAR! 💪";
    playSound("hit");
  }
  
  const resultDiv = document.getElementById("quizResult");
  resultDiv.innerHTML = `
    <div class="quiz-score">Skor: ${quizScore}/${total} (${percentage}%)</div>
    <div style="font-size: 24px; margin-bottom: 10px;">${grade}</div>
    <div>${message}</div>
    <button class="quiz-restart" onclick="restartQuiz()">🔄 COBA LAGI</button>
    <button class="quiz-restart" onclick="closeQuiz()">🏠 KE MENU</button>
  `;
  resultDiv.style.background = "rgba(255,102,204,0.2)";
  resultDiv.style.border = "1px solid #ff66cc";
  
  document.getElementById("quizNextBtn").style.display = "none";
}

// ================= RESTART KUIS =================
function restartQuiz() {
  currentQuestionIndex = 0;
  quizScore = 0;
  quizAnswered = false;
  quizActive = true;
  
  document.getElementById("quizNextBtn").style.display = "block";
  document.getElementById("quizNextBtn").disabled = true;
  displayQuestion();
}

// ================= TUTUP KUIS =================
function closeQuiz() {
  const quizScreen = document.getElementById("quizScreen");
  if (quizScreen) {
    quizScreen.style.display = "none";
  }
  gameMenu.style.display = "flex";
  mode = "";
}

// ================= SET CANVAS =================
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ================= DATA GAME =================
let player = { x: 100, y: 100, size: 30 };
let enemy = { x: 400, y: 200, size: 30, dx: 3, dy: 2 };
let item = { x: 200, y: 200, size: 20 };

let mazeWalls = [];
let mazeFlags = [];
let mazeEnemies = [];
let flagsCollected = 0;
let totalFlags = 3;

let score = 0;
let life = 3;
let target = 6;
let running = false;

// ================= INPUT =================
let keys = {};

document.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
});

document.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// ================= START GAME =================
function startGame() {
  score = 0;
  life = 3;
  invincible = false;
  player.x = 100;
  player.y = 100;
  gameRunning = true;
  flagsCollected = 0;
  currentLevel = 1;
  
  canvas.style.display = "block";
  hud.style.display = "flex";
  
  if (gameVideo) {
    gameVideo.style.display = "block";
    gameVideo.play().catch(() => {});
  }
  
  running = true;
  
  if (mode === "box") {
    target = 6;
    item.x = Math.random() * (canvas.width - item.size);
    item.y = Math.random() * (canvas.height - item.size);
    enemy.x = 400;
    enemy.y = 200;
    enemy.dx = 3;
    enemy.dy = 2;
  } else if (mode === "maze") {
    target = totalFlags;
    setupMaze();
  } else if (mode === "jump") {
    target = 999;
    return;
  }
  
  updateHUD();
  
  if (bgm && !isMuted) {
    bgm.volume = 0.3;
    bgm.play().catch(() => {});
  }
  
  gameLoop();
}

// ================= SETUP MAZE =================
function setupMaze() {
  mazeWalls = [];
  mazeFlags = [];
  mazeEnemies = [];
  
  mazeWalls.push({ x: 0, y: 0, width: canvas.width, height: 20 });
  mazeWalls.push({ x: 0, y: canvas.height - 20, width: canvas.width, height: 20 });
  mazeWalls.push({ x: 0, y: 0, width: 20, height: canvas.height });
  mazeWalls.push({ x: canvas.width - 20, y: 0, width: 20, height: canvas.height });
  
  mazeWalls.push({ x: 150, y: 100, width: 200, height: 20 });
  mazeWalls.push({ x: 500, y: 100, width: 200, height: 20 });
  mazeWalls.push({ x: 100, y: 200, width: 150, height: 20 });
  mazeWalls.push({ x: 400, y: 200, width: 200, height: 20 });
  mazeWalls.push({ x: 650, y: 250, width: 120, height: 20 });
  mazeWalls.push({ x: 200, y: 350, width: 250, height: 20 });
  mazeWalls.push({ x: 550, y: 380, width: 150, height: 20 });
  mazeWalls.push({ x: 100, y: 480, width: 200, height: 20 });
  mazeWalls.push({ x: 450, y: 520, width: 250, height: 20 });
  mazeWalls.push({ x: 300, y: 600, width: 200, height: 20 });
  
  mazeWalls.push({ x: 300, y: 50, width: 20, height: 150 });
  mazeWalls.push({ x: 600, y: 120, width: 20, height: 150 });
  mazeWalls.push({ x: 200, y: 220, width: 20, height: 150 });
  mazeWalls.push({ x: 500, y: 250, width: 20, height: 150 });
  mazeWalls.push({ x: 350, y: 300, width: 20, height: 150 });
  mazeWalls.push({ x: 680, y: 300, width: 20, height: 150 });
  mazeWalls.push({ x: 150, y: 400, width: 20, height: 150 });
  mazeWalls.push({ x: 450, y: 420, width: 20, height: 150 });
  mazeWalls.push({ x: 600, y: 450, width: 20, height: 150 });
  mazeWalls.push({ x: 250, y: 520, width: 20, height: 150 });
  mazeWalls.push({ x: 550, y: 550, width: 20, height: 100 });
  
  let flagPositions = [
    { x: canvas.width - 120, y: 120, size: 25 },
    { x: 120, y: canvas.height - 120, size: 25 },
    { x: canvas.width - 200, y: canvas.height - 200, size: 25 }
  ];
  
  for (let i = 0; i < flagPositions.length; i++) {
    mazeFlags.push({
      x: flagPositions[i].x,
      y: flagPositions[i].y,
      size: 25,
      collected: false
    });
  }
  
  let baseSpeed = 1.5;
  let speedMultiplier = 1 + (currentLevel - 1) * 0.4;
  let enemySpeed = baseSpeed * speedMultiplier;
  let enemyCount = Math.min(4 + Math.floor(currentLevel / 2), 10);
  
  let enemyPositions = [
    { x: 250, y: 150 }, { x: 500, y: 300 }, { x: 350, y: 500 },
    { x: 600, y: 550 }, { x: 150, y: 400 }, { x: 550, y: 200 },
    { x: 400, y: 100 }, { x: 300, y: 600 }, { x: 680, y: 450 }, { x: 100, y: 250 }
  ];
  
  for (let i = 0; i < enemyCount && i < enemyPositions.length; i++) {
    let pos = enemyPositions[i];
    let dx = (Math.random() > 0.5 ? enemySpeed : -enemySpeed);
    let dy = (Math.random() > 0.5 ? enemySpeed : -enemySpeed);
    
    mazeEnemies.push({
      x: pos.x, y: pos.y, size: 28, dx: dx, dy: dy
    });
  }
  
  player.x = 50;
  player.y = 50;
}

// ================= NAIK LEVEL =================
function nextLevel() {
  currentLevel++;
  
  vibrate([100, 50, 100]);
  playSound("levelup");
  
  hitFlash.style.opacity = "0.8";
  hitFlash.style.background = "white";
  setTimeout(() => { 
    hitFlash.style.opacity = "0";
    hitFlash.style.background = "red";
  }, 500);
  
  flagsCollected = 0;
  score = 0;
  setupMaze();
  updateHUD();
}

// ================= UPDATE =================
function update() {
  if (!running) return;
  
  let oldX = player.x;
  let oldY = player.y;
  
  let moveX = 0, moveY = 0;
  if (keys["d"] || keys["arrowright"]) moveX = 5;
  if (keys["a"] || keys["arrowleft"]) moveX = -5;
  if (keys["w"] || keys["arrowup"]) moveY = -5;
  if (keys["s"] || keys["arrowdown"]) moveY = 5;
  
  player.x += moveX;
  player.y += moveY;
  
  if (mode === "maze") {
    for (let wall of mazeWalls) {
      if (player.x < wall.x + wall.width &&
          player.x + player.size > wall.x &&
          player.y < wall.y + wall.height &&
          player.y + player.size > wall.y) {
        player.x = oldX;
        player.y = oldY;
        break;
      }
    }
  }
  
  if (mode === "box") {
    player.x = Math.max(0, Math.min(canvas.width - player.size, player.x));
    player.y = Math.max(0, Math.min(canvas.height - player.size, player.y));
  } else {
    player.x = Math.max(20, Math.min(canvas.width - player.size - 20, player.x));
    player.y = Math.max(20, Math.min(canvas.height - player.size - 20, player.y));
  }
  
  if (mode === "box") {
    enemy.x += enemy.dx;
    enemy.y += enemy.dy;
    
    if (enemy.x <= 0 || enemy.x >= canvas.width - enemy.size) enemy.dx *= -1;
    if (enemy.y <= 0 || enemy.y >= canvas.height - enemy.size) enemy.dy *= -1;
    
    if (collision(player, item)) {
      score++;
      playSound("collect");
      item.x = Math.random() * (canvas.width - item.size);
      item.y = Math.random() * (canvas.height - item.size);
      updateHUD();
    }
    
    if (collision(player, enemy) && !invincible) {
      life--;
      invincible = true;
      playSound("hit");
      vibrate(200);
      hitFlash.style.opacity = "0.5";
      setTimeout(() => { hitFlash.style.opacity = "0"; }, 200);
      setTimeout(() => { invincible = false; }, 1000);
      updateHUD();
    }
  } else if (mode === "maze") {
    for (let i = 0; i < mazeEnemies.length; i++) {
      let e = mazeEnemies[i];
      let oldEx = e.x;
      let oldEy = e.y;
      
      e.x += e.dx;
      e.y += e.dy;
      
      let hitWall = false;
      for (let wall of mazeWalls) {
        if (e.x < wall.x + wall.width &&
            e.x + e.size > wall.x &&
            e.y < wall.y + wall.height &&
            e.y + e.size > wall.y) {
          hitWall = true;
          break;
        }
      }
      
      if (e.x <= 20 || e.x >= canvas.width - e.size - 20) hitWall = true;
      if (e.y <= 20 || e.y >= canvas.height - e.size - 20) hitWall = true;
      
      if (hitWall) {
        e.dx *= -1;
        e.dy *= -1;
        e.x = oldEx;
        e.y = oldEy;
      }
      
      if (collision(player, e) && !invincible) {
        life--;
        invincible = true;
        playSound("hit");
        vibrate(200);
        hitFlash.style.opacity = "0.5";
        setTimeout(() => { hitFlash.style.opacity = "0"; }, 200);
        setTimeout(() => { invincible = false; }, 1000);
        updateHUD();
        player.x = 50;
        player.y = 50;
      }
    }
    
    for (let i = 0; i < mazeFlags.length; i++) {
      let flag = mazeFlags[i];
      if (!flag.collected && collision(player, flag)) {
        flag.collected = true;
        flagsCollected++;
        score = flagsCollected;
        playSound("collect");
        updateHUD();
        
        hitFlash.style.opacity = "0.3";
        setTimeout(() => { hitFlash.style.opacity = "0"; }, 100);
        
        if (flagsCollected >= flagsForNextLevel) {
          if (currentLevel < maxLevel) {
            nextLevel();
          } else {
            win();
          }
        }
        break;
      }
    }
  }
  
  if (score >= target && mode !== "maze") win();
  if (life <= 0) lose();
}

// ================= DRAW =================
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = "white";
  ctx.font = "bold 20px Arial";
  ctx.fillText("👤 " + playerName, 20, 40);
  
  if (mode === "box") {
    drawBoxGame();
  } else if (mode === "maze") {
    drawMazeGame();
    
    ctx.fillStyle = "#ffcc00";
    ctx.font = "bold 24px Arial";
    ctx.shadowBlur = 5;
    ctx.shadowColor = "black";
    ctx.fillText(`⭐ LEVEL ${currentLevel} ⭐`, canvas.width - 150, 50);
    ctx.shadowBlur = 0;
  }
}

function drawBoxGame() {
  if (invincible && Math.floor(Date.now() / 100) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }
  
  ctx.fillStyle = "#00ffff";
  ctx.fillRect(player.x, player.y, player.size, player.size);
  ctx.strokeStyle = "white";
  ctx.strokeRect(player.x, player.y, player.size, player.size);
  
  ctx.globalAlpha = 1;
  
  ctx.fillStyle = "#ff4444";
  ctx.fillRect(enemy.x, enemy.y, enemy.size, enemy.size);
  
  ctx.fillStyle = "#ffff00";
  ctx.shadowBlur = 10;
  ctx.shadowColor = "yellow";
  ctx.fillRect(item.x, item.y, item.size, item.size);
  ctx.shadowBlur = 0;
}

function drawMazeGame() {
  ctx.fillStyle = "#555555";
  for (let wall of mazeWalls) {
    ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
    ctx.strokeStyle = "#888888";
    ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
  }
  
  for (let flag of mazeFlags) {
    if (!flag.collected) {
      ctx.fillStyle = "#ff6600";
      ctx.fillRect(flag.x, flag.y, flag.size, flag.size);
      ctx.fillStyle = "#ffcc00";
      ctx.font = "20px Arial";
      ctx.fillText("🏁", flag.x + 3, flag.y + 20);
    }
  }
  
  for (let e of mazeEnemies) {
    ctx.fillStyle = "#ff3333";
    ctx.fillRect(e.x, e.y, e.size, e.size);
    ctx.fillStyle = "white";
    ctx.fillRect(e.x + 8, e.y + 8, 5, 5);
    ctx.fillRect(e.x + 18, e.y + 8, 5, 5);
    ctx.fillStyle = "black";
    ctx.fillRect(e.x + 9, e.y + 9, 3, 3);
    ctx.fillRect(e.x + 19, e.y + 9, 3, 3);
    ctx.fillStyle = "darkred";
    ctx.fillRect(e.x + 12, e.y + 18, 8, 4);
  }
  
  if (invincible && Math.floor(Date.now() / 100) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }
  
  ctx.fillStyle = "#00ff88";
  ctx.fillRect(player.x, player.y, player.size, player.size);
  ctx.strokeStyle = "white";
  ctx.strokeRect(player.x, player.y, player.size, player.size);
  
  ctx.fillStyle = "white";
  ctx.fillRect(player.x + 8, player.y + 8, 5, 5);
  ctx.fillRect(player.x + 18, player.y + 8, 5, 5);
  ctx.fillStyle = "#ff6600";
  ctx.fillRect(player.x + 12, player.y + 20, 8, 5);
  
  ctx.globalAlpha = 1;
}

// ================= UPDATE HUD =================
function updateHUD() {
  if (mode === "box") {
    document.getElementById("scoreText").innerHTML = `🎯 Score: ${score} / ${target}`;
  } else if (mode === "maze") {
    document.getElementById("scoreText").innerHTML = `🏁 Bendera: ${flagsCollected} / ${flagsForNextLevel} | 👾 Musuh: ${mazeEnemies.length} | ⭐ Level: ${currentLevel}`;
  } else if (mode === "jump") {
    document.getElementById("scoreText").innerHTML = `🦘 Skor Lompat: ${jumpScore}`;
  }
  
  let hearts = "";
  for (let i = 0; i < life; i++) hearts += "❤️ ";
  for (let i = life; i < 3; i++) hearts += "🖤 ";
  document.getElementById("lifeText").innerHTML = hearts;
}

function collision(a, b) {
  return a.x < b.x + (b.size || b.width) &&
         a.x + a.size > (b.x || b.x) &&
         a.y < b.y + (b.size || b.height) &&
         a.y + a.size > (b.y || b.y);
}

function gameLoop() {
  if (!running) return;
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

function win() {
  running = false;
  gameRunning = false;
  playSound("win");
  vibrate([200, 100, 200, 100, 500]);
  
  canvas.style.display = "none";
  hud.style.display = "none";
  if (gameVideo) gameVideo.style.display = "none";
  if (bgm) bgm.pause();
  
  let winMessage = mode === "maze" ? 
    ` SELAMAT ${playerName}! <br>KAMU BERHASIL MELEWATI ${currentLevel} LEVEL! 🏆🏆🏆` :
    ` SELAMAT ${playerName}! <br>KAMU MENANG DI GAME ada ada aja 🏆`;
  
  document.getElementById("winText").innerHTML = winMessage;
  messageScreen.style.display = "flex";
}

function lose() {
  running = false;
  gameRunning = false;
  vibrate(500);
  
  canvas.style.display = "none";
  hud.style.display = "none";
  if (gameVideo) gameVideo.style.display = "none";
  if (bgm) bgm.pause();
  
  if (mode === "maze") {
    document.getElementById("finalScore").innerHTML = `${playerName} | Level: ${currentLevel} | Bendera: ${flagsCollected} / ${flagsForNextLevel}`;
  } else if (mode === "jump") {
    document.getElementById("finalScore").innerHTML = `${playerName} | Skor Lompat: ${jumpScore}`;
  } else {
    document.getElementById("finalScore").innerHTML = `${playerName} | Score: ${score} / ${target}`;
  }
  gameOver.style.display = "flex";
}

function restartGame() {
  location.reload();
}
// ================= GAME LOMPAT (LENGKAP) =================
let jumpGameRunning = false;
let jumpPlayer = { x: 100, y: 0, width: 30, height: 30 };
let jumpVelocity = 0;
let jumpGravity = 0.8;
let jumpPower = -12;
let groundY = 0;
let obstacles = [];
let jumpScore = 0;
let jumpFrame = 0;
let gameStarted = false;

function startJumpGame() {
  mode = "jump";
  gameMenu.style.display = "none";
  
  jumpGameRunning = true;
  jumpScore = 0;
  jumpFrame = 0;
  obstacles = [];
  jumpPlayer.y = 0;
  jumpVelocity = 0;
  gameStarted = false;
  life = 3;
  invincible = false;
  
  canvas.style.display = "block";
  hud.style.display = "flex";
  if (gameVideo) gameVideo.style.display = "block";
  
  running = true;
  
  updateHUD();
  
  if (bgm && !isMuted) {
    bgm.volume = 0.3;
    bgm.play().catch(() => {});
  }
  
  jumpGameLoop();
}

function jumpGameLoop() {
  if (!running || mode !== "jump") return;
  
  updateJump();
  drawJump();
  
  requestAnimationFrame(jumpGameLoop);
}

function updateJump() {
  if (!jumpGameRunning) return;
  
  groundY = canvas.height - 50;
  
  // Lompat dengan SPACE, W, atau panah atas
  if ((keys[" "] || keys["w"] || keys["arrowup"]) && jumpPlayer.y >= groundY - jumpPlayer.height && !gameStarted) {
    jumpVelocity = jumpPower;
    gameStarted = true;
    playSound("collect");
  }
  
  jumpVelocity += jumpGravity;
  jumpPlayer.y += jumpVelocity;
  
  // Tanah
  if (jumpPlayer.y >= groundY - jumpPlayer.height) {
    jumpPlayer.y = groundY - jumpPlayer.height;
    jumpVelocity = 0;
    gameStarted = false;
  }
  
  // Langit-langit
  if (jumpPlayer.y < 0) {
    jumpPlayer.y = 0;
    if (jumpVelocity < 0) jumpVelocity = 0;
  }
  
  // Munculin rintangan (semakin tinggi skor, semakin cepat muncul)
  jumpFrame++;
  let spawnRate = Math.max(40, 70 - Math.floor(jumpScore / 15));
  if (jumpFrame > spawnRate) {
    jumpFrame = 0;
    let obstacleHeight = 25 + Math.random() * 25;
    obstacles.push({
      x: canvas.width,
      y: groundY - obstacleHeight,
      width: 25,
      height: obstacleHeight,
      passed: false
    });
  }
  
  // Gerakin rintangan (semakin tinggi skor, semakin cepat)
  let speed = 5 + Math.floor(jumpScore / 40);
  for (let i = 0; i < obstacles.length; i++) {
    obstacles[i].x -= speed;
    
    // Tabrakan dengan player
    if (!obstacles[i].passed &&
        jumpPlayer.x < obstacles[i].x + obstacles[i].width &&
        jumpPlayer.x + jumpPlayer.width > obstacles[i].x &&
        jumpPlayer.y + jumpPlayer.height > obstacles[i].y &&
        jumpPlayer.y < obstacles[i].y + obstacles[i].height) {
      
      if (!invincible) {
        life--;
        invincible = true;
        playSound("hit");
        vibrate(200);
        hitFlash.style.opacity = "0.5";
        setTimeout(() => { hitFlash.style.opacity = "0"; }, 200);
        setTimeout(() => { invincible = false; }, 1000);
        updateHUD();
        
        if (life <= 0) {
          loseJump();
        }
      }
      obstacles[i].passed = true;
    }
    
    // Tambah skor saat berhasil melewati rintangan
    if (!obstacles[i].passed && obstacles[i].x + obstacles[i].width < jumpPlayer.x) {
      obstacles[i].passed = true;
      jumpScore++;
      playSound("collect");
      updateHUD();
    }
  }
  
  // Hapus rintangan yang keluar layar
  obstacles = obstacles.filter(obs => obs.x + obs.width > 0);
}

function drawJump() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Draw langit
  let gradSky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradSky.addColorStop(0, "#87CEEB");
  gradSky.addColorStop(1, "#E0F7FA");
  ctx.fillStyle = gradSky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw ground
  ctx.fillStyle = "#8B4513";
  ctx.fillRect(0, groundY, canvas.width, 5);
  ctx.fillStyle = "#654321";
  ctx.fillRect(0, groundY + 5, canvas.width, 45);
  
  // Draw grass
  ctx.fillStyle = "#228B22";
  for (let i = 0; i < canvas.width; i += 30) {
    ctx.fillRect(i, groundY - 5, 10, 10);
  }
  
  // Draw obstacles (batang merah dengan duri)
  for (let obs of obstacles) {
    let grad = ctx.createLinearGradient(obs.x, obs.y, obs.x + obs.width, obs.y + obs.height);
    grad.addColorStop(0, "#ff4444");
    grad.addColorStop(1, "#aa0000");
    ctx.fillStyle = grad;
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    
    // Duri
    ctx.fillStyle = "#ff8888";
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(obs.x + 5 + i * 5, obs.y - 5, 3, 8);
    }
    
    // Mata jahat di rintangan
    ctx.fillStyle = "white";
    ctx.fillRect(obs.x + 5, obs.y + 5, 5, 5);
    ctx.fillRect(obs.x + 15, obs.y + 5, 5, 5);
    ctx.fillStyle = "black";
    ctx.fillRect(obs.x + 6, obs.y + 6, 3, 3);
    ctx.fillRect(obs.x + 16, obs.y + 6, 3, 3);
  }
  
  // Draw player (karakter lucu)
  if (gameStarted && jumpVelocity < 0) {
    // Animasi lompat
    ctx.fillStyle = "#e171a0";
    ctx.fillRect(jumpPlayer.x, jumpPlayer.y, jumpPlayer.width, jumpPlayer.height);
    // Mata
    ctx.fillStyle = "white";
    ctx.fillRect(jumpPlayer.x + 22, jumpPlayer.y + 8, 5, 5);
    ctx.fillStyle = "black";
    ctx.fillRect(jumpPlayer.x + 23, jumpPlayer.y + 9, 3, 3);
    // Mulut terbuka (senang)
    ctx.beginPath();
    ctx.arc(jumpPlayer.x + 15, jumpPlayer.y + 22, 6, 0, Math.PI);
    ctx.fillStyle = "#ff6600";
    ctx.fill();
  } else {
    // Karakter berdiri
    ctx.fillStyle = "#00ff88";
    ctx.fillRect(jumpPlayer.x, jumpPlayer.y, jumpPlayer.width, jumpPlayer.height);
    // Mata
    ctx.fillStyle = "white";
    ctx.fillRect(jumpPlayer.x + 22, jumpPlayer.y + 8, 5, 5);
    ctx.fillStyle = "black";
    ctx.fillRect(jumpPlayer.x + 23, jumpPlayer.y + 9, 3, 3);
    // Senyum
    ctx.beginPath();
    ctx.arc(jumpPlayer.x + 15, jumpPlayer.y + 22, 6, 0, Math.PI);
    ctx.fillStyle = "#ff6600";
    ctx.fill();
  }
  
  // Nama player di pojok kiri atas
  ctx.fillStyle = "white";
  ctx.font = "bold 20px Arial";
  ctx.shadowBlur = 3;
  ctx.shadowColor = "black";
  ctx.fillText("👤 " + playerName, 20, 40);
  
  // Instruksi
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px Arial";
  ctx.fillText("⬆️ Tekan SPACE / W / ↑ untuk lompat!", canvas.width / 2 - 150, 80);
  ctx.fillText("🦘 Skor: " + jumpScore, canvas.width / 2 - 40, 120);
  
  // Efek shadow di tanah
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.fillRect(jumpPlayer.x + 5, groundY + 10, jumpPlayer.width - 10, 5);
  
  ctx.shadowBlur = 0;
}

function loseJump() {
  running = false;
  jumpGameRunning = false;
  gameRunning = false;
  
  canvas.style.display = "none";
  hud.style.display = "none";
  if (gameVideo) gameVideo.style.display = "none";
  if (bgm) bgm.pause();
  
  document.getElementById("finalScore").innerHTML = `${playerName} | Skor Lompat: ${jumpScore}`;
  gameOver.style.display = "flex";
}