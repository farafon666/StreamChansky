import { registerRoomHandlers } from './handlers/room-handler.js';
import { registerTransportHandlers } from './handlers/transport-handler.js';
import { registerProducerConsumerHandlers } from './handlers/producer-consumer-handler.js';
import { registerChatHandlers } from './handlers/chat-handler.js';
import { registerDisconnectHandlers } from './handlers/disconnect-handler.js';

/**
 * Настраивает Socket.IO сервер, регистрируя все обработчики событий.
 * @param io - Экземпляр Socket.IO сервера
 */
export function setupSocketIO(io) {
  io.on('connection', (socket) => {
    console.log('Пользователь подключился: ', socket.id);

    // Состояние сокета (локальное для этого соединения)
    const state = {
      currentRoomId: null,
      userName: null,
    };

    // Регистрация всех обработчиков
    registerRoomHandlers(socket, io, state);
    registerTransportHandlers(socket, io, state);
    registerProducerConsumerHandlers(socket, io, state);
    registerChatHandlers(socket, io, state);
    registerDisconnectHandlers(socket, io, state);
  });
}
