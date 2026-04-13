import express from 'express';
import https from 'https';
import { Server as socketIO } from 'socket.io';
import { HTTPS_PORT, SSL_OPTIONS } from './config/server-config.js';
import setupRoutes from './routes/index.js';
import { setupSocketIO } from './socket/index.js';

// Создаем Express приложение
const app = express();

// Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Настройка маршрутов
setupRoutes(app);

// Создаем HTTPS сервер
const server = https.createServer(SSL_OPTIONS, app);

// Инициализируем Socket.IO с HTTPS сервером
const io = new socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Настраиваем обработчики Socket.IO
setupSocketIO(io);

// Запуск сервера
server.listen(HTTPS_PORT, () => {
  console.log(`https://localhost:${HTTPS_PORT}`);
});
