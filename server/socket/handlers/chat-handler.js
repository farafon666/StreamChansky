/**
 * Регистрирует обработчик сообщений чата.
 * @param {Socket} socket - Socket.IO сокет
 * @param {Server} io - Socket.IO сервер
 * @param {object} state - Состояние сокета (currentRoomId, userName)
 */
export function registerChatHandlers(socket, io, state) {
  // Сообщение в чате
  socket.on('message', (message) => {
    if (state.currentRoomId && state.userName) {
      io.to(state.currentRoomId).emit(
        'create-message',
        message,
        state.userName,
      );
    }
  });
}
