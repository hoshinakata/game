const socket = io();

let gameId = null;
let playerSymbol = null; // 'X' или 'O'
let board = Array(9).fill(null);
let currentTurn = 'X';
let gameActive = false;

const setupDiv = document.getElementById('game-setup');
const gameBoardDiv = document.getElementById('game-board');
const gameInfo = document.getElementById('game-info');
const statusDiv = document.getElementById('status');
const restartBtn = document.getElementById('restart-btn');

// Создание игровой доски (9 клеток)
const boardElement = document.querySelector('.board');
for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.classList.add('cell');
    cell.dataset.index = i;
    cell.addEventListener('click', () => handleCellClick(i));
    boardElement.appendChild(cell);
}
const cells = document.querySelectorAll('.cell');

// Обновление отображения доски
function renderBoard() {
    cells.forEach((cell, index) => {
        cell.textContent = board[index] || '';
        if (board[index]) {
            cell.classList.add('taken');
        } else {
            cell.classList.remove('taken');
        }
    });
}

// Обновление статуса
function updateStatus() {
    if (!gameActive) return;
    if (playerSymbol === currentTurn) {
        statusDiv.textContent = 'Ваш ход';
    } else {
        statusDiv.textContent = 'Ход соперника';
    }
}

// Обработка клика по клетке
function handleCellClick(index) {
    if (!gameActive) return;
    if (playerSymbol !== currentTurn) {
        alert('Сейчас не ваш ход');
        return;
    }
    if (board[index] !== null) return;

    socket.emit('makeMove', { gameId, index });
}

// Создание игры
document.getElementById('create-btn').addEventListener('click', () => {
    socket.emit('createGame');
});

// Подключение к игре
document.getElementById('join-btn').addEventListener('click', () => {
    const id = document.getElementById('game-id-input').value.trim().toUpperCase();
    if (id) {
        socket.emit('joinGame', id);
    }
});

// Перезапуск игры
restartBtn.addEventListener('click', () => {
    socket.emit('restartGame', gameId);
});

// --- События сокета ---

socket.on('gameCreated', (data) => {
    gameId = data.gameId;
    playerSymbol = data.playerSymbol;
    gameActive = true;
    setupDiv.style.display = 'none';
    gameBoardDiv.style.display = 'block';
    gameInfo.textContent = `Код игры: ${gameId}. Отправьте его другу.`;
    statusDiv.textContent = 'Ожидание второго игрока...';
});

socket.on('gameJoined', (data) => {
    gameId = data.gameId;
    playerSymbol = data.playerSymbol;
    gameActive = true;
    setupDiv.style.display = 'none';
    gameBoardDiv.style.display = 'block';
    gameInfo.textContent = `Вы подключились к игре ${gameId}`;
    // Доска пока пуста, обновится после startGame
});

socket.on('startGame', (data) => {
    board = data.board;
    currentTurn = data.turn;
    renderBoard();
    updateStatus();
    restartBtn.style.display = 'none';
});

socket.on('updateBoard', (data) => {
    board = data.board;
    currentTurn = data.turn;
    renderBoard();
    updateStatus();
});

socket.on('gameOver', (data) => {
    gameActive = false;
    board = data.board;
    renderBoard();
    if (data.winner === 'draw') {
        statusDiv.textContent = 'Ничья!';
    } else if (data.winner === playerSymbol) {
        statusDiv.textContent = 'Вы победили!';
    } else {
        statusDiv.textContent = 'Победил соперник.';
    }
    restartBtn.style.display = 'inline-block';
});

socket.on('gameRestarted', (data) => {
    board = data.board;
    currentTurn = data.turn;
    gameActive = true;
    renderBoard();
    updateStatus();
    restartBtn.style.display = 'none';
});

socket.on('opponentDisconnected', () => {
    alert('Соперник отключился. Игра завершена.');
    gameActive = false;
    // Можно вернуться к созданию новой игры
    setupDiv.style.display = 'block';
    gameBoardDiv.style.display = 'none';
    gameInfo.textContent = '';
});

socket.on('errorMessage', (msg) => {
    alert(msg);
});