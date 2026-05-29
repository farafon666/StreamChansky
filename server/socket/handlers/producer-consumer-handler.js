import { getRoom } from '../../services/room-service.js';

/**
 * Регистрирует обработчики producer, consumer и consumer-resume.
 * @param {Socket} socket - Socket.IO сокет
 * @param {Server} io - Socket.IO сервер
 * @param {object} state - Состояние сокета (currentRoomId, userName)
 */
export function registerProducerConsumerHandlers(socket, io, state) {
  // Создание producer
  socket.on(
    'produce',
    async ({ transportId, kind, rtpParameters }, callback) => {
      const room = getRoom(state.currentRoomId);
      if (!room) return callback({ error: 'Комната не найдена.' });

      const transport = room.transports.get(socket.id)?.sendTransport;
      if (!transport || transport.id !== transportId) {
        return callback({ error: 'Транспорт не найден.' });
      }

      try {
        const producer = await transport.produce({ kind, rtpParameters });
        producer.appData = {
          socketId: socket.id,
          userName: state.userName,
        };

        // Сохраняем продюсер в комнате
        room.producers.set(producer.id, producer);

        // Оповещаем всех остальных участников о новом продюсере
        for (const otherSocketId of room.sockets) {
          if (otherSocketId !== socket.id) {
            io.to(otherSocketId).emit('new-producer', {
              producerId: producer.id,
              kind,
              userName: state.userName,
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
    const room = getRoom(state.currentRoomId);
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
    const room = getRoom(state.currentRoomId);
    if (!room) return;
    const consumer = room.consumers?.get(consumerId);
    if (consumer) {
      await consumer.resume();
    }
  });

  // Закрытие продюсера
  socket.on('close-producer', async ({ producerId }, callback) => {
    const room = getRoom(state.currentRoomId);
    if (!room) {
      if (callback) callback({ error: 'Комната не найдена.' });
      return;
    }

    const producer = room.producers.get(producerId);
    if (!producer) {
      if (callback) callback({ error: 'Продюсер не найден.' });
      return;
    }

    // Проверяем, что продюсер принадлежит этому сокету
    if (producer.appData.socketId !== socket.id) {
      if (callback) callback({ error: 'Ошибка закрытия продюсера.' });
      return;
    }

    try {
      producer.close();
      room.producers.delete(producerId);

      // Оповещаем всех остальных участников о закрытии продюсера
      for (const otherSocketId of room.sockets) {
        if (otherSocketId !== socket.id) {
          io.to(otherSocketId).emit('producer-closed', { producerId });
        }
      }

      if (callback) callback({ success: true });
    } catch (err) {
      console.error(`Ошибка закрытия продюсера ${producerId}:`, err);
      if (callback) callback({ error: err.message });
    }
  });
}
