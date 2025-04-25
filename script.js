// --- Ensure HTML is loaded first (defer attribute in HTML recommended) ---

const canvas = document.getElementById('gameCanvas');
if (!canvas) {
    alert("HTML 오류: id가 'gameCanvas'인 캔버스 요소를 찾을 수 없습니다!");
    throw new Error("Canvas not found");
}

const ctx = canvas.getContext('2d');
if (!ctx) {
    alert("캔버스 컨텍스트를 가져올 수 없습니다. 브라우저가 지원하지 않을 수 있습니다.");
    throw new Error("Canvas context failed");
}
ctx.imageSmoothingEnabled = false;

// DOM Elements
const scoreEl = document.getElementById('score');
const correctCountEl = document.getElementById('correct-count');
const timerEl = document.getElementById('timer');
const roundEl = document.getElementById('round-display');
const quizModal = document.getElementById('quizModal');
const questionTextEl = document.getElementById('questionText');
const answerInput = document.getElementById('answerInput');
const submitAnswerBtn = document.getElementById('submitAnswer');
const feedbackEl = document.getElementById('feedback');
const gameOverScreen = document.getElementById('gameOverScreen');
const finalTimeEl = document.getElementById('finalTime');
const resultsListEl = document.getElementById('resultsList');
const restartGameBtn = document.getElementById('restartGame');
const pauseBtn = document.getElementById('pauseBtn');
const resumeBtn = document.getElementById('resumeBtn');
const gameMessageEl = document.getElementById('gameMessage');

if (!scoreEl || !correctCountEl || !timerEl || !roundEl || !quizModal || !questionTextEl || !answerInput || !submitAnswerBtn || !feedbackEl || !gameOverScreen || !finalTimeEl || !resultsListEl || !restartGameBtn || !pauseBtn || !resumeBtn || !gameMessageEl) {
     console.error("HTML 오류: 필요한 DOM 요소 중 일부가 없습니다. index.html의 ID를 확인하세요.");
}

// --- Game Constants ---
const PADDLE_HEIGHT = 15;
const PADDLE_INITIAL_WIDTH = 100;
const PADDLE_MIN_WIDTH = 40;
const PADDLE_MAX_WIDTH = 160;
const PADDLE_SPEED = 8;
const BALL_RADIUS = 8;
const INITIAL_BALL_SPEED = 4;
// *** FIX: Ball speed increased again by 10% ***
const BALL_SPEED_MULTIPLIER = 0.968; // Previous 0.88 -> 0.88 * 1.1 = 0.968
const BASE_SPEED_X = INITIAL_BALL_SPEED * BALL_SPEED_MULTIPLIER;
const BASE_SPEED_Y = INITIAL_BALL_SPEED * BALL_SPEED_MULTIPLIER;
const BRICK_HEIGHT = 20;
const BRICK_PADDING = 8;
const BRICK_OFFSET_TOP = 40;
const BRICK_OFFSET_LEFT = 20;
const PILL_RADIUS = 8;
const PILL_SPEED = 2;
const TOTAL_QUESTIONS_TO_WIN = 6;

// --- Game Variables ---
let score = 0;
let correctAnswersCount = 0;
let startTime;
let gameInterval = null;
let timerInterval = null;
let isPaused = false;
let isGameOver = false;
let manualPause = false;
let currentRound = 1;
let balls = [];
let paddle = {
    height: PADDLE_HEIGHT, width: PADDLE_INITIAL_WIDTH,
    x: (canvas.width - PADDLE_INITIAL_WIDTH) / 2, speed: PADDLE_SPEED,
    minWidth: PADDLE_MIN_WIDTH, maxWidth: PADDLE_MAX_WIDTH
};
let rightPressed = false;
let leftPressed = false;
let brickRowCount;
let brickColumnCount;
let brickWidth;
let bricks = [];
let pills = [];
const pillTypes = ['quiz', 'speed_up', 'speed_reset', 'multi_ball', 'paddle_grow', 'paddle_shrink'];
// *** FIX: Adjusted pill probabilities again ***
const pillProbabilities = [0.72, 0.056, 0.056, 0.056, 0.056, 0.056]; // Quiz: 72%, Others: ~5.6% each
const pillColors = {
    'quiz': '#5cb85c', 'speed_up': '#d9534f', 'speed_reset': '#ffffff',
    'multi_ball': '#5bc0de', 'paddle_grow': '#f0ad4e', 'paddle_shrink': '#777777'
};
const questions = [
    { id: 1, question: "여러 민족으로 이루어진 국가에서, 자기 민족의 언어를 국어 또는 외국에 상대하여 이르는 말", answer: "모국어", correctlyAnswered: false },
    { id: 2, question: "오라고 청하지 않았는데도 스스로 찾아온 손님", answer: "불청객", correctlyAnswered: false },
    { id: 3, question: "다른 나라에서 온 사람", answer: "이방인", correctlyAnswered: false },
    { id: 4, question: "용기나 의욕이 솟아나도록 복돋워 줌", answer: "격려", correctlyAnswered: false },
    { id: 5, question: "남의 감정, 의견, 주장 따위에 자기도 그렇다고 느낌", answer: "공감", correctlyAnswered: false },
    { id: 6, question: "서로 밀접하게 연결되어 있는 공통된 느낌", answer: "유대감", correctlyAnswered: false }
];
let currentQuiz = null;

// --- Initialization Functions ---

function setupBricks(round) {
    try {
        bricks = [];
        brickColumnCount = 8 + Math.min(round - 1, 4);
        brickRowCount = 4 + Math.min(round - 1, 3);
        if (brickColumnCount <= 0) { console.warn("Warning: brickColumnCount <= 0. Setting to 1."); brickColumnCount = 1; }
        const canvasWidth = canvas ? canvas.width : 800;
        brickWidth = Math.floor((canvasWidth - 2 * BRICK_OFFSET_LEFT - (brickColumnCount - 1) * BRICK_PADDING) / brickColumnCount);
        if (brickWidth <= 0) { console.error("Error: Calculated brick width <= 0. Setting fallback."); brickWidth = 10; }

        let specialBrickIndices = new Set();
        const totalBricks = brickRowCount * brickColumnCount;
        // *** FIX: Increased special brick percentage to ~42% ***
        const numSpecialBricks = Math.max(1, Math.floor(totalBricks * 0.42));
        while (specialBrickIndices.size < numSpecialBricks && specialBrickIndices.size < totalBricks) { specialBrickIndices.add(Math.floor(Math.random() * totalBricks)); }

        let brickIndex = 0;
        for (let c = 0; c < brickColumnCount; c++) {
            bricks[c] = [];
            for (let r = 0; r < brickRowCount; r++) {
                const brickX = Math.floor(c * (brickWidth + BRICK_PADDING) + BRICK_OFFSET_LEFT);
                const brickY = Math.floor(r * (BRICK_HEIGHT + BRICK_PADDING) + BRICK_OFFSET_TOP);
                let hits = 1; let color = '#0095DD';
                if (round >= 2 && Math.random() < 0.2) { hits = 2; color = '#f0ad4e'; }
                if (round >= 3 && Math.random() < 0.15) { hits = 3; color = '#d9534f'; }
                const isSpecial = specialBrickIndices.has(brickIndex);
                bricks[c][r] = { x: brickX, y: brickY, status: hits, isSpecial: isSpecial, baseColor: color, width: brickWidth, height: BRICK_HEIGHT };
                brickIndex++;
            }
        }
    } catch (error) { console.error(`Error during setupBricks(${round}):`, error); throw error; }
}

function addBall(x, y, dx, dy) {
    try { balls.push({ x: x, y: y, radius: BALL_RADIUS, dx: dx, dy: dy, baseSpeedX: Math.abs(dx), baseSpeedY: Math.abs(dy) }); }
    catch (error) { console.error("Error during addBall:", error); throw error; }
}

function resetBallPaddle() {
    try {
        balls = [];
        paddle.width = PADDLE_INITIAL_WIDTH;
        const canvasWidth = canvas ? canvas.width : 800;
        paddle.x = Math.floor((canvasWidth - paddle.width) / 2);
        addBall( canvasWidth / 2, (canvas ? canvas.height : 600) - paddle.height - 20, BASE_SPEED_X * (Math.random() > 0.5 ? 1 : -1), -BASE_SPEED_Y );
    } catch (error) { console.error("Error during resetBallPaddle:", error); throw error; }
}


function initRound(round) {
    try {
        currentRound = round;
        if(roundEl) roundEl.textContent = `ROUND: ${round}`;
        pills = [];
        resetBallPaddle();
        setupBricks(round);
        if (round === 1) {
            score = 0; correctAnswersCount = 0;
            if(questions && typeof questions.forEach === 'function') {
                questions.forEach(q => { if(q) q.correctlyAnswered = false; });
            } else { console.error("Error: 'questions' array is not valid."); }
            updateScore(); updateCorrectCount();
            startTimer();
        }
        isPaused = false; manualPause = false;
        if(resumeBtn) resumeBtn.style.display = 'none';
        if(pauseBtn) pauseBtn.style.display = 'inline-block';
        if(gameMessageEl) gameMessageEl.style.display = 'none';
    } catch (error) { console.error(`Error during initRound(${round}):`, error); throw error; }
}

function startGame() {
    try {
        isGameOver = false;
        if(gameOverScreen) gameOverScreen.style.display = 'none';
        if(quizModal) quizModal.style.display = 'none';
        if (gameInterval) { clearInterval(gameInterval); gameInterval = null; }
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }

        initRound(1);

        if (ctx && balls && balls.length > 0 && bricks && bricks.length > 0) {
             gameInterval = setInterval(draw, 16);
        } else {
             console.error("Game initialization failed (balls, bricks, or context missing/invalid), cannot start game loop.");
             alert("게임 초기화에 실패했습니다. 콘솔을 확인하세요.");
        }
    } catch (error) {
        console.error("Error during startGame:", error);
        alert("게임을 시작하는 중 오류가 발생했습니다. 콘솔을 확인하세요.");
    }
}

// --- Drawing Functions ---
function drawBall(ball) { if (!ctx || !ball) return; ctx.beginPath(); ctx.rect(Math.floor(ball.x - ball.radius), Math.floor(ball.y - ball.radius), ball.radius * 2, ball.radius * 2); ctx.fillStyle = "#eee"; ctx.fill(); ctx.closePath(); }
function drawPaddle() { if (!ctx) return; ctx.beginPath(); ctx.rect(Math.floor(paddle.x), canvas.height - paddle.height - 10, Math.floor(paddle.width), paddle.height); ctx.fillStyle = "#00ccff"; ctx.fill(); ctx.closePath(); }
function drawBricks() { if (!ctx || !bricks || bricks.length === 0) return; for (let c = 0; c < bricks.length; c++) { if (!bricks[c]) continue; for (let r = 0; r < bricks[c].length; r++) { const brick = bricks[c][r]; if (!brick) continue; if (brick.status > 0) { ctx.beginPath(); ctx.rect(brick.x, brick.y, brick.width, brick.height); let color = brick.baseColor; if (brick.isSpecial) { color = '#cc00cc'; } else if (brick.status === 3) { color = '#d9534f'; } else if (brick.status === 2) { color = '#f0ad4e'; } ctx.fillStyle = color; ctx.fill(); ctx.closePath(); } } } }
function drawPills() { if (!ctx || !pills) return; pills.forEach(pill => { if (!pill) return; ctx.beginPath(); ctx.rect(Math.floor(pill.x - PILL_RADIUS), Math.floor(pill.y - PILL_RADIUS), PILL_RADIUS * 2, PILL_RADIUS * 2); ctx.fillStyle = pillColors[pill.type] || "#ffcc00"; ctx.fill(); ctx.closePath(); }); }
function updateScore() { if(scoreEl) scoreEl.textContent = `SCORE: ${score}`; }
function updateCorrectCount() { if(correctCountEl) correctCountEl.textContent = `QUIZ: ${correctAnswersCount} / ${TOTAL_QUESTIONS_TO_WIN}`; }
function updateTimer() { if (isPaused || isGameOver || !timerEl) return; const now = Date.now(); const elapsedSeconds = startTime ? Math.floor((now - startTime) / 1000) : 0; timerEl.textContent = `TIME: ${elapsedSeconds}s`; }
function startTimer() { startTime = Date.now(); if (timerInterval) clearInterval(timerInterval); timerInterval = setInterval(updateTimer, 1000); }

// --- Movement and Collision Functions ---
function moveBalls() { if (!balls || isPaused || isGameOver) return; for (let i = balls.length - 1; i >= 0; i--) { let ball = balls[i]; if (!ball) continue; ball.x += ball.dx; ball.y += ball.dy; if (ball.x + ball.radius > canvas.width || ball.x - ball.radius < 0) { ball.dx = -ball.dx; ball.x = Math.max(ball.radius, Math.min(canvas.width - ball.radius, ball.x)); } if (ball.y - ball.radius < 0) { ball.dy = -ball.dy; ball.y = ball.radius; } if (ball.dy > 0 && ball.y + ball.radius >= canvas.height - paddle.height - 10 && ball.y - ball.radius < canvas.height - 10 && ball.x + ball.radius > paddle.x && ball.x - ball.radius < paddle.x + paddle.width) { ball.dy = -ball.dy; ball.y = canvas.height - paddle.height - 10 - ball.radius; let collidePoint = ball.x - (paddle.x + paddle.width / 2); const paddleWidthFactor = paddle.width > 0 ? paddle.width / 2 : 1; ball.dx = (collidePoint / paddleWidthFactor) * ball.baseSpeedX * 1.5; } if (ball.y + ball.radius > canvas.height) { balls.splice(i, 1); } } if (balls.length === 0 && !isGameOver) { resetBallPaddle(); } }
function movePaddle() { if (isPaused || isGameOver) return; if (rightPressed && paddle.x < canvas.width - paddle.width) { paddle.x += paddle.speed; } else if (leftPressed && paddle.x > 0) { paddle.x -= paddle.speed; } paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, paddle.x)); }
function movePills() { if (!pills || isPaused || isGameOver) return; pills.forEach((pill, index) => { if(pill) { pill.y += PILL_SPEED; if (pill.y - PILL_RADIUS > canvas.height) { pills.splice(index, 1); } }}); }
function getRandomPillType() { let rand = Math.random(); let cumulativeProb = 0; for (let i = 0; i < pillTypes.length; i++) { cumulativeProb += pillProbabilities[i]; if (rand < cumulativeProb) { if (pillTypes[i] === 'quiz') { const availableQuestions = questions.filter(q => !q.correctlyAnswered); if (availableQuestions.length > 0) return 'quiz'; else continue; } return pillTypes[i]; } } return 'speed_reset'; }
function collisionDetection() { if (!balls || !bricks || isPaused || isGameOver) return; let allBricksCleared = true; for (let i = balls.length - 1; i >= 0; i--) { let ball = balls[i]; if (!ball) continue; brick_check_loop: for (let c = 0; c < bricks.length; c++) { if (!bricks[c]) continue; for (let r = 0; r < bricks[c].length; r++) { const b = bricks[c][r]; if (!b) continue; if (b.status > 0) { allBricksCleared = false; const ballLeft = ball.x - ball.radius; const ballRight = ball.x + ball.radius; const ballTop = ball.y - ball.radius; const ballBottom = ball.y + ball.radius; const brickLeft = b.x; const brickRight = b.x + b.width; const brickTop = b.y; const brickBottom = b.y + b.height; if (ballRight > brickLeft && ballLeft < brickRight && ballBottom > brickTop && ballTop < brickBottom) { ball.dy = -ball.dy; if (ball.dy < 0) { ball.y = b.y - ball.radius - 1; } else { ball.y = b.y + b.height + ball.radius + 1; } b.status--; if (b.status === 0) { score += 10; updateScore(); if (b.isSpecial) { const pillType = getRandomPillType(); if (pillType) { pills.push({ x: b.x + b.width / 2, y: b.y + b.height / 2, type: pillType }); } } } break brick_check_loop; } } } } } if (allBricksCleared && bricks.length > 0 && !isGameOver) { if (correctAnswersCount >= TOTAL_QUESTIONS_TO_WIN) { endGame(true); } else { currentRound++; initRound(currentRound); } } }
function applyPillEffect(type) { if (!balls) return; switch (type) { case 'quiz': triggerQuiz(); break; case 'speed_up': balls.forEach(ball => { if(ball) { ball.dx *= 1.1; ball.dy *= 1.1; }}); break; case 'speed_reset': balls.forEach(ball => { if(ball) { ball.dx = Math.sign(ball.dx) * BASE_SPEED_X; ball.dy = Math.sign(ball.dy) * BASE_SPEED_Y; }}); break; case 'multi_ball': if (balls.length > 0 && balls.length < 5) { const originalBall = balls[Math.floor(Math.random()*balls.length)]; if (originalBall) { addBall(originalBall.x + 5, originalBall.y, -BASE_SPEED_X * 0.9, originalBall.dy); addBall(originalBall.x - 5, originalBall.y, BASE_SPEED_X * 1.1, originalBall.dy); } } else if (balls.length === 0) { resetBallPaddle(); } break; case 'paddle_grow': paddle.width = Math.min(paddle.maxWidth, paddle.width * 1.2); paddle.x = Math.min(canvas.width - paddle.width, paddle.x); break; case 'paddle_shrink': paddle.width = Math.max(paddle.minWidth, paddle.width * 0.8); break; default: console.warn("Unknown pill type in applyPillEffect:", type); } }
function pillCollectionDetection() { if (!pills || isPaused || isGameOver) return; const paddleBottom = canvas.height - 10; const paddleTop = canvas.height - paddle.height - 10; for (let i = pills.length - 1; i >= 0; i--) { const pill = pills[i]; if(!pill) continue; if (pill.y + PILL_RADIUS >= paddleTop && pill.y - PILL_RADIUS <= paddleBottom && pill.x > paddle.x && pill.x < paddle.x + paddle.width) { const collectedPillType = pill.type; pills.splice(i, 1); applyPillEffect(collectedPillType); } } }

// --- Quiz Logic ---
function triggerQuiz() { if (isPaused || isGameOver || manualPause || !quizModal) return; const availableQuestions = questions.filter(q => !q.correctlyAnswered); if (availableQuestions.length === 0) { console.log("TriggerQuiz: No available questions."); return; } isPaused = true; currentQuiz = availableQuestions[Math.floor(Math.random() * availableQuestions.length)]; if(questionTextEl) questionTextEl.textContent = currentQuiz.question; if(answerInput) answerInput.value = ''; if(feedbackEl) feedbackEl.textContent = ''; if(quizModal) { quizModal.style.display = 'flex'; } else { console.error("Quiz modal element not found!"); } if(answerInput) answerInput.focus(); if(pauseBtn) pauseBtn.disabled = true; if(resumeBtn) resumeBtn.disabled = true; }
function submitAnswer() { if (!currentQuiz || !answerInput || !feedbackEl || !quizModal) return; const playerAnswer = answerInput.value.trim(); const correctAnswer = currentQuiz.answer; if (playerAnswer.toLowerCase() === correctAnswer.toLowerCase()) { feedbackEl.textContent = "CORRECT! +50 PTS"; feedbackEl.style.color = '#0f0'; score += 50; correctAnswersCount++; const questionIndex = questions.findIndex(q => q.id === currentQuiz.id); if (questionIndex !== -1) { questions[questionIndex].correctlyAnswered = true; } updateScore(); updateCorrectCount(); } else { feedbackEl.textContent = `INCORRECT. Answer: ${correctAnswer}`; feedbackEl.style.color = '#f00'; } quizModal.style.display = 'none'; currentQuiz = null; if(gameMessageEl) { gameMessageEl.textContent = '게임을 시작합니다. 준비하세요!'; gameMessageEl.style.display = 'block'; } setTimeout(() => { if(gameMessageEl) gameMessageEl.style.display = 'none'; isPaused = false; manualPause = false; if(pauseBtn) { pauseBtn.disabled = false; pauseBtn.style.display = 'inline-block'; } if(resumeBtn) { resumeBtn.disabled = false; resumeBtn.style.display = 'none'; } if (correctAnswersCount >= TOTAL_QUESTIONS_TO_WIN) { endGame(true); } }, 1000); }

// --- Game State Management ---
function pauseGame() { if (!isPaused && !isGameOver && quizModal && quizModal.style.display === 'none' && gameMessageEl && pauseBtn && resumeBtn) { isPaused = true; manualPause = true; gameMessageEl.textContent = 'PAUSED'; gameMessageEl.style.display = 'block'; pauseBtn.style.display = 'none'; resumeBtn.style.display = 'inline-block'; resumeBtn.focus(); } }
function resumeGame() { if (isPaused && manualPause && !isGameOver && gameMessageEl && pauseBtn && resumeBtn) { isPaused = false; manualPause = false; gameMessageEl.style.display = 'none'; pauseBtn.style.display = 'inline-block'; resumeBtn.style.display = 'none'; pauseBtn.focus(); } }
function endGame(isWin) { isGameOver = true; isPaused = true; if (gameInterval) clearInterval(gameInterval); if (timerInterval) clearInterval(timerInterval); const finalTimeSeconds = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0; if (finalTimeEl) finalTimeEl.textContent = `TOTAL TIME: ${finalTimeSeconds}s`; if(resultsListEl) resultsListEl.innerHTML = ''; const h2 = gameOverScreen ? gameOverScreen.querySelector('h2') : null; const p = gameOverScreen ? gameOverScreen.querySelector('p') : null; if (isWin) { if(h2) h2.textContent = 'YOU WIN!'; if(p) p.textContent = '모든 문제를 맞추셨습니다!'; if(resultsListEl) { questions.forEach(q => { const listItem = document.createElement('li'); listItem.textContent = `Q${q.id}: ${q.question} - A: ${q.answer}`; resultsListEl.appendChild(listItem); }); } } else { if(h2) h2.textContent = 'GAME OVER'; if(p) p.textContent = ''; } if(gameOverScreen) gameOverScreen.style.display = 'flex'; }

// --- Main Game Loop ---
function draw() {
    try {
        if (isGameOver) return;
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawBricks(); drawPaddle(); drawPills(); if (balls) balls.forEach(drawBall);
        if (!isPaused) { moveBalls(); movePaddle(); movePills(); collisionDetection(); pillCollectionDetection(); }
    } catch (error) {
        console.error("Error in draw loop:", error);
        if (gameInterval) clearInterval(gameInterval);
        alert("게임 실행 중 오류가 발생하여 중단되었습니다. 콘솔을 확인하세요.");
        isGameOver = true;
    }
}

// --- Event Listeners ---
function handleKeyDown(e) { if (e.key === 'Right' || e.key === 'ArrowRight') { rightPressed = true; } else if (e.key === 'Left' || e.key === 'ArrowLeft') { leftPressed = true; } else if (e.key === 'p' || e.key === 'P') { if (quizModal && quizModal.style.display === 'none') { if (manualPause) resumeGame(); else pauseGame(); } } }
function handleKeyUp(e) { if (e.key === 'Right' || e.key === 'ArrowRight') { rightPressed = false; } else if (e.key === 'Left' || e.key === 'ArrowLeft') { leftPressed = false; } }
function handleAnswerKeypress(e) { if (e.key === 'Enter' && quizModal && quizModal.style.display === 'flex') { submitAnswer(); } }

// --- Setup Event Listeners ---
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
if(pauseBtn) pauseBtn.addEventListener('click', pauseGame);
if(resumeBtn) resumeBtn.addEventListener('click', resumeGame);
if(submitAnswerBtn) submitAnswerBtn.addEventListener('click', submitAnswer);
if(answerInput) answerInput.addEventListener('keypress', handleAnswerKeypress);
if(restartGameBtn) restartGameBtn.addEventListener('click', startGame);

// --- Start the game ---
function tryStartGame() {
    if (canvas && ctx) {
        startGame();
    } else {
        console.error("Canvas not ready at the time of starting.");
        alert("캔버스 초기화 오류! 페이지를 새로고침하거나 브라우저를 확인하세요.");
    }
}

window.addEventListener('DOMContentLoaded', (event) => {
     if (!canvas || !ctx) {
          console.error("Canvas or context still not available after DOMContentLoaded!");
          alert("캔버스 초기화 오류! 페이지를 새로고침하거나 브라우저를 확인하세요.");
          return;
     }
    tryStartGame();
});