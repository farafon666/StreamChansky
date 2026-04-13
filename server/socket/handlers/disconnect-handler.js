import {
  getRoom,
  removeSocketFromRoom,
  deleteRoom,
} from '../../services/room-service.js';

/**
 * Регистрирует обработчик отключения клиента.
 * @param {Socket} socket - Socket.IO сокет
 * @param {Server} io - Socket.IO сервер
 * @param {object} state - Состояние сокета (currentRoomId, userName)
 */
export function registerDisconnectHandlers(socket, io, state) {
  socket.on('disconnect', async () => {
    if (!state.currentRoomId) return;
    const room = getRoom(state.currentRoomId);
    if (!room) return;

    // Удаляем все продюсеры этого сокета
    for (const [producerId, producer] of room.producers.entries()) {
      if (producer.appData.socketId === socket.id) {
        producer.close();
        room.producers.delete(producerId);
        // Оповещаем всех о закрытии продюсера
        io.to(state.currentRoomId).emit('producer-closed', { producerId });
      }
    }

    // Закрываем транспорты
    const transports = room.transports.get(socket.id);
    if (transports) {
      if (transports.sendTransport) {
        try {
          await transports.sendTransport.close();
        } catch (err) {
          console.error(`Ошибка закрытия sendTransport для ${socket.id}:`, err);
        }
      }
      if (transports.recvTransport) {
        try {
          await transports.recvTransport.close();
        } catch (err) {
          console.error(`Ошибка закрытия recvTransport для ${socket.id}:`, err);
        }
      }
      room.transports.delete(socket.id);
    }

    // Удаляем сокет из комнаты
    removeSocketFromRoom(state.currentRoomId, socket.id);
    socket.leave(state.currentRoomId);

    // Если комната пуста, удаляем её
    deleteRoom(state.currentRoomId);

    console.log(`Клиент ${socket.id} отключился.`);
  });
}
