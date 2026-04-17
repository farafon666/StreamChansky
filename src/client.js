import { initWebRTC, localStreamPromise, localStream } from './webrtc.js';
import { initChat } from './chat.js';
import { initUI } from './ui.js';

const socket = io('/');

// Имя пользователя
const user = prompt('Enter your name:');

// Инициализация модулей
initWebRTC(socket, user, ROOM_ID);
initChat(socket, user);

// Инициализация UI после получения локального потока
localStreamPromise.then((stream) => {
  if (stream) {
    initUI(stream);
  } else {
    console.warn('Локальный поток не доступен, UI инициализирован без него');
    // Все равно инициализируем UI
    initUI(null);
  }
});
