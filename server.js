import express from 'express';
import fs from 'fs';
import https from 'https';
import { Server as socketIO } from 'socket.io';
import { rooms, createRoom, cleanupRoom } from './mediasoup-worker.js';
import { createWebRtcTransport } from './mediasoup-transport.js';
import { v4 as uuidv4 } from 'uuid';

// Конфигурация HTTPS
const HTTPS_PORT = 3030;
const SSL_OPTIONS = {
  key: fs.readFileSync('certs/localhost+2-key.pem'),
  cert: fs.readFileSync('certs/localhost+2.pem'),
};

// Создаем HTTPS сервер
const app = express();
const server = https.createServer(SSL_OPTIONS, app);

// Инициализируем Socket.IO с HTTPS сервером
const io = new socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Маршруты
app.get('/', (_, res) => {
  res.redirect(`/${uuidv4()}`);
});
app.get('/:room', (req, res) => {
  res.render('room', { roomId: req.params.room });
});

// Socket.IO события
io.on('connection', (socket) => {
  console.log('Пользователь подключился: ', socket.id);

  let currentRoomId = null;
  let userName = null;

  // Подключение пользователя к комнате
  socket.on('join-room', async ({ roomId, userName: joinedUserName }) => {
    currentRoomId = roomId;
    userName = joinedUserName;

    // Получение роутера комнаты
    const router = await createRoom(roomId);
    const room = rooms.get(roomId);

    // Сохранение сокета в комнате
    room.sockets.add(socket.id);
    socket.join(roomId);

    // Отправка клиенту rtpCapabilities роутера
    socket.emit('router-capabilities', router.rtpCapabilities);
    console.log(
      `Клиент ${socket.id} присоединился к комнате ${roomId} как ${userName}`,
    );
  });

  // Создание транспортов (по запросу клиента)
  socket.on('create-transports', async () => {
    if (!currentRoomId) return;

    const room = rooms.get(currentRoomId);
    if (!room) return;

    try {
      // Создание транспортов для отправки и приёма
      const sendTransport = await createWebRtcTransport(room.router);
      const recvTransport = await createWebRtcTransport(room.router);

      // Сохранение транспортов по socket.id
      room.transports.set(socket.id, { sendTransport, recvTransport });

      // Отправка параметров транспортов клиенту
      socket.emit('transport-created', {
        sendTransportOptions: {
          id: sendTransport.id,
          iceParameters: sendTransport.iceParameters,
          iceCandidates: sendTransport.iceCandidates,
          dtlsParameters: sendTransport.dtlsParameters,
        },
        recvTransportOptions: {
          id: recvTransport.id,
          iceParameters: recvTransport.iceParameters,
          iceCandidates: recvTransport.iceCandidates,
          dtlsParameters: recvTransport.dtlsParameters,
        },
      });

      // Отправка новому клиенту список уже существующих продюсеров в комнате
      for (const [producerId, producer] of room.producers.entries()) {
        // Не отправляем продюсеры этого же клиента (если он уже успел что-то создать)
        if (producer.appData.socketId !== socket.id) {
          socket.emit('new-producer', { producerId, kind: producer.kind });
        }
      }
    } catch (err) {
      console.error(`Ошибка создания транспортов для ${socket.id}:`, err);
    }
  });

  // Подключение транспорта (DTLS)
  socket.on(
    'transport-connect',
    async ({ transportId, dtlsParameters }, callback) => {
      const room = rooms.get(currentRoomId);
      if (!room) return callback({ error: 'Комната не найдена.' });

      const transport = room.transports.get(socket.id)?.[
        transportId === room.transports.get(socket.id)?.sendTransport.id
          ? 'sendTransport'
          : 'recvTransport'
      ];

      if (!transport) return callback({ error: 'Транспорт не найден.' });

      try {
        await transport.connect({ dtlsParameters });
        callback({});
      } catch (err) {
        console.error(`Ошибка подключения транспорта ${transportId}: `, err);
        callback({ error: err.message });
      }
    },
  );

  // Создание producer
  socket.on(
    'produce',
    async ({ transportId, kind, rtpParameters }, callback) => {
      const room = rooms.get(currentRoomId);
      if (!room) return callback({ error: 'Комната не найдена.' });

      const transport = room.transports.get(socket.id)?.sendTransport;
      if (!transport || transport.id !== transportId) {
        return callback({ error: 'Транспорт не найден.' });
      }

      try {
        const producer = await transport.produce({ kind, rtpParameters });
        producer.appData = { socketId: socket.id };

        // Сохраняем продюсер в комнате
        room.producers.set(producer.id, producer);

        // Оповещаем всех остальных участников о новом продюсере
        for (const otherSocketId of room.sockets) {
          if (otherSocketId !== socket.id) {
            io.to(otherSocketId).emit('new-producer', {
              producerId: producer.id,
              kind,
            });
          }
        }

        callback({ id: producer.id });
      } catch (err) {
        console.error(`Ошибка создания продюсера: `, err);
        callback({ error: err.message });
      }
    },
  );

  // Создание consumer
  socket.on('consume', async ({ producerId, rtpCapabilities }, callback) => {
    const room = rooms.get(currentRoomId);
    if (!room) return callback({ error: 'Комната не найдена.' });
    const producer = room.producers.get(producerId);
    if (!producer) return callback({ error: 'Продюсер не найден.' });
    const transports = room.transports.get(socket.id);
    if (!transports) return callback({ error: 'Транспорт не найден.' });

    try {
      const consumer = await transports.recvTransport.consume({
        producerId,
        rtpCapabilities,
        paused: true,
      });

      // Сохраняем consumer для последующего resume
      if (!room.consumers) room.consumers = new Map();
      room.consumers.set(consumer.id, consumer);

      callback({
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    } catch (err) {
      console.error(`Ошибка создания consumer: `, err);
      callback({ error: err.message });
    }
  });

  // Возобновление consumer (после того как клиент создал consumer)
  socket.on('consumer-resume', async ({ consumerId }) => {
    const room = rooms.get(currentRoomId);
    if (!room) return;
    const consumer = room.consumers?.get(consumerId);
    if (consumer) {
      await consumer.resume();
    }
  });

  // Сообщение в чате
  socket.on('message', (message) => {
    if (currentRoomId && userName) {
      io.to(currentRoomId).emit('create-message', message, userName);
    }
  });

  // Отключение клиента
  socket.on('disconnect', async () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    // Удаляем все продюсеры этого сокета
    for (const [producerId, producer] of room.producers.entries()) {
      if (producer.appData.socketId === socket.id) {
        producer.close();
        room.producers.delete(producerId);
        // Оповещаем всех о закрытии продюсера
        io.to(currentRoomId).emit('producer-closed', { producerId });
      }
    }

    // Закрываем транспорты
    const transports = room.transports.get(socket.id);
    if (transports) {
      if (transports.sendTransport) await transports.sendTransport.close();
      if (transports.recvTransport) await transports.recvTransport.close();
      room.transports.delete(socket.id);
    }

    // Удаляем сокет из комнаты
    room.sockets.delete(socket.id);
    socket.leave(currentRoomId);

    // Если комната пуста, удаляем её
    cleanupRoom(currentRoomId);

    console.log(`Клиент ${socket.id} отключился.`);
  });
});

// Запуск сервера
server.listen(HTTPS_PORT, () => {
  console.log(`https://localhost:${HTTPS_PORT}`);
});
