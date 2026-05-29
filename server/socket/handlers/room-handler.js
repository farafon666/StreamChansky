import { createRoom } from '../../mediasoup-worker.js';
import { getRoom, addSocketToRoom } from '../../services/room-service.js';

/**
 * Регистрирует обработчики событий комнаты.
 * @param {Socket} socket - Socket.IO сокет
 * @param {Server} io - Socket.IO сервер
 * @param {object} state - Состояние сокета (currentRoomId, userName)
 */
export function registerRoomHandlers(socket, io, state) {
  // Подключение пользователя к комнате
  socket.on('join-room', async ({ roomId, userName: joinedUserName }) => {
    state.currentRoomId = roomId;
    state.userName = joinedUserName;

    // Получение роутера комнаты
    const router = await createRoom(roomId);
    const room = getRoom(roomId);

    // Сохранение сокета в комнате
    addSocketToRoom(roomId, socket.id);
    socket.join(roomId);

    // Отправка клиенту rtpCapabilities роутера
    socket.emit('router-capabilities', router.rtpCapabilities);
    console.log(
      `Клиент ${socket.id} присоединился к комнате ${state.currentRoomId} как ${state.userName}`,
    );
  });

  // Создание транспортов (по запросу клиента)
  socket.on('create-transports', async () => {
    if (!state.currentRoomId) return;

    const room = getRoom(state.currentRoomId);
    if (!room) return;

    try {
      // Создание транспортов для отправки и приёма
      const { createWebRtcTransport } =
        await import('../../mediasoup-transport.js');
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
          socket.emit('new-producer', {
            producerId,
            kind: producer.kind,
            userName: producer.appData.userName || 'No name',
          });
        }
      }
    } catch (err) {
      console.error(`Ошибка создания транспортов для ${socket.id}:`, err);
    }
  });
}
