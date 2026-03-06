const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Хранилище активных игр: gameId -> { players: [socketId, socketId], board, turn, gameOver }
const games = {};

io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  // Создание новой игры (комнаты)
  socket.on('createGame', () => {
    const gameId = generateGameId();
    games[gameId] = {
      players: [socket.id],
      board: Array(9).fill(null),
      turn: 'X',
      gameOver: false
    };
    socket.join(gameId);
    socket.emit('gameCreated', { gameId, playerSymbol: 'X' });
    console.log(`Игра ${gameId} создана игроком ${socket.id}`);
  });

  // Подключение к существующей игре
  socket.on('joinGame', (gameId) => {
    const game = games[gameId];
    if (!game) {
      socket.emit('errorMessage', 'Игра не найдена');
      return;
    }
    if (game.players.length >= 2) {
      socket.emit('errorMessage', 'В игре уже два игрока');
      return;
    }

    game.players.push(socket.id);
    socket.join(gameId);
    socket.emit('gameJoined', { gameId, playerSymbol: 'O' });

    // Уведомляем первого игрока, что второй подключился
    io.to(gameId).emit('startGame', { board: game.board, turn: game.turn });
    console.log(`Игрок ${socket.id} присоединился к игре ${gameId}`);
  });

  // Обработка хода
  socket.on('makeMove', ({ gameId, index }) => {
    const game = games[gameId];
    if (!game) return;
    if (game.gameOver) return;

    // Определяем, чей сейчас ход и кто сделал ход
    const playerIndex = game.players.indexOf(socket.id);
    if (playerIndex === -1) return; // игрок не в этой игре
    const currentSymbol = game.turn;
    // X ходит первым (playerIndex 0), O - вторым (playerIndex 1)
    if ((currentSymbol === 'X' && playerIndex !== 0) || (currentSymbol === 'O' && playerIndex !== 1)) {
      socket.emit('errorMessage', 'Сейчас не ваш ход');
      return;
    }

    if (game.board[index] !== null) return; // клетка занята

    // Обновляем доску
    game.board[index] = currentSymbol;

    // Проверяем победу или ничью
    const winner = checkWinner(game.board);
    let gameOver = false;
    if (winner) {
      gameOver = true;
      io.to(gameId).emit('gameOver', { winner, board: game.board });
    } else if (!game.board.includes(null)) {
      gameOver = true;
      io.to(gameId).emit('gameOver', { winner: 'draw', board: game.board });
    }

    if (gameOver) {
      game.gameOver = true;
      return;
    }

    // Меняем ход
    game.turn = currentSymbol === 'X' ? 'O' : 'X';

    // Отправляем обновлённое состояние всем в комнате
    io.to(gameId).emit('updateBoard', { board: game.board, turn: game.turn });
  });

  // Перезапуск игры (по желанию)
  socket.on('restartGame', (gameId) => {
    const game = games[gameId];
    if (!game) return;
    // Очищаем доску
    game.board = Array(9).fill(null);
    game.turn = 'X';
    game.gameOver = false;
    io.to(gameId).emit('gameRestarted', { board: game.board, turn: game.turn });
  });

  // Отключение игрока
  socket.on('disconnect', () => {
    console.log('Игрок отключился:', socket.id);
    // Находим игры, где был этот игрок, и удаляем их (или помечаем)
    for (const gameId in games) {
      const game = games[gameId];
      const index = game.players.indexOf(socket.id);
      if (index !== -1) {
        // Уведомляем другого игрока, если он есть
        socket.to(gameId).emit('opponentDisconnected');
        delete games[gameId];
        break;
      }
    }
  });
});

// Генератор короткого ID игры
function generateGameId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Проверка победителя
function checkWinner(board) {
  const lines = [
    [0,1,2], [3,4,5], [6,7,8], // rows
    [0,3,6], [1,4,7], [2,5,8], // columns
    [0,4,8], [2,4,6]           // diagonals
  ];
  for (let [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});