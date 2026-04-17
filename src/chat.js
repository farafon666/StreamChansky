// Инициализация чат модуля
export function initChat(socket, user) {
  const text = document.querySelector('#chatMessage');
  const send = document.getElementById('send');
  const messages = document.querySelector('.messages');

  send.addEventListener('click', (e) => {
    if (text.value.length !== 0) {
      socket.emit('message', text.value);
      text.value = '';
    }
  });

  text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && text.value.length !== 0) {
      socket.emit('message', text.value);
      text.value = '';
    }
  });

  socket.on('create-message', (message, userName) => {
    messages.innerHTML =
      messages.innerHTML +
      `<div class="message">
          <b><i class="far fa-user-circle"></i> <span> ${userName === user ? 'me' : userName}</span> </b>
          <p class="message__time">${new Date().toLocaleTimeString()}</p>
          <span>${message}</span>
      </div>`;
  });
}
