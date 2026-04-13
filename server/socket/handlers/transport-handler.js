import { getRoom } from '../../services/room-service.js';

/**
 * Регистрирует обработчик подключения транспорта (DTLS).
 * @param {Socket} socket - Socket.IO сокет
 * @param {Server} io - Socket.IO сервер
 * @param {object} state - Состояние сокета (currentRoomId, userName)
 */
export function registerTransportHandlers(socket, io, state) {
  socket.on(
    'transport-connect',
    async ({ transportId, dtlsParameters }, callback) => {
      const room = getRoom(state.currentRoomId);
      if (!room) return callback({ error: 'Комната не найдена.' });

      const transports = room.transports.get(socket.id);
      if (!transports) return callback({ error: 'Транспорты не найдены.' });

      let transport = null;
      if (
        transports.sendTransport &&
        transports.sendTransport.id === transportId
      ) {
        transport = transports.sendTransport;
      } else if (
        transports.recvTransport &&
        transports.recvTransport.id === transportId
      ) {
        transport = transports.recvTransport;
      }

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
}
