const socket = io('/');
import { Device } from 'mediasoup-client';

/*
  WebRTC block
  ******************************************************************************************************************************
*/
// Элементы интерфейса
const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');

// Имя пользователя
const user = prompt('Enter your name:');

// Состояние приложения
let device; // mediasoup Device
let sendTransport; // Транспорт для отправки
let recvTransport; // Транспорт для приёма
let localStream; // Локальный медиапоток
let producers = []; // Массив продюсеров (аудио, видео)
let consumers = new Map(); // Карта потребителей: ключ - producerId, значение - consumer

// Получение локального медиапотока
navigator.mediaDevices &&
  navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: true,
    })
    .then((stream) => {
      localStream = stream;
      addVideoStream(myVideo, stream);
    })
    .catch((error) => {
      console.error('Ошибка доступа к медиаустройствам: ', error);
    });

// Коннект к комнате после получения потока
socket.on('connect', () => {
  socket.emit('join-room', { roomId: ROOM_ID, userName: user });
});

// Обработка события от mediasoup-сервера с RTP-возможностями роутера
socket.on('router-capabilities', async (routerRtpCapabilities) => {
  try {
    // Создание устройства mediasoup
    device = new Device();
    await device.load({ routerRtpCapabilities });

    // Запрос создания транспортов на сервере
    socket.emit('create-transports');
  } catch (error) {
    console.error('Ошибка при создании транспорта: ', error);
  }
});

// Обработка создания транспорта
socket.on(
  'transport-created',
  async ({ sendTransportOptions, recvTransportOptions }) => {
    try {
      // Создание send и recv транспортов
      sendTransport = device.createSendTransport(sendTransportOptions);
      recvTransport = device.createRecvTransport(recvTransportOptions);

      // Обработка событий send транспорта
      sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        socket.emit(
          'transport-connect',
          {
            transportId: sendTransport.id,
            dtlsParameters,
          },
          (response) => {
            if (response.error) {
              errback(response.error);
            } else {
              callback();
            }
          },
        );
      });

      sendTransport.on(
        'produce',
        ({ kind, rtpParameters }, callback, errback) => {
          socket.emit(
            'produce',
            {
              transportId: sendTransport.id,
              kind,
              rtpParameters,
            },
            (response) => {
              if (response.error) {
                errback(response.error);
              } else {
                callback({ id: response.id });
              }
            },
          );
        },
      );

      // Обработка событий recv транспорта
      recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        socket.emit(
          'transport-connect',
          {
            transportId: recvTransport.id,
            dtlsParameters,
          },
          (response) => {
            if (response.error) {
              errback(response.error);
            } else {
              callback();
            }
          },
        );
      });

      // Публикация локальных треков
      await publishLocalTracks();
    } catch (error) {
      console.error('Ошибка при создании транспортов: ', error);
    }
  },
);

// Обработка новых продюсеров в комнате
socket.on('new-producer', async ({ producerId, kind }) => {
  try {
    // Запрашиваем создание consumer у сервера
    const { id, rtpParameters } = await new Promise((resolve, reject) => {
      socket.emit(
        'consume',
        {
          producerId,
          rtpCapabilities: device.rtpCapabilities,
        },
        (response) => {
          if (response.error) reject(new Error(response.error));
          else resolve(response);
        },
      );
    });

    // Создаём consumer на клиенте
    const consumer = await recvTransport.consume({
      id,
      producerId,
      kind,
      rtpParameters,
    });

    consumers.set(producerId, consumer);

    // Добавляем видео в сетку
    const remoteVideo = document.createElement('video');
    remoteVideo.srcObject = new MediaStream([consumer.track]);
    remoteVideo.addEventListener('loadedmetadata', () => {
      remoteVideo.play();
      videoGrid.append(remoteVideo);
    });

    // Возобновляем передачу
    await consumer.resume();
    socket.emit('consumer-resume', { consumerId: consumer.id });
  } catch (err) {
    console.error('Ошибка создания потребителя:', err);
  }
});

// Обработка удаления продюсера (когда пользователь покинул комнату)
socket.on('producer-closed', ({ producerId }) => {
  const consumer = consumers.get(producerId);
  if (consumer) {
    consumer.close();
    consumers.delete(producerId);
    // Находим соответствующий видеоэлемент и удаляем его
    const videoElements = videoGrid.querySelectorAll('video');
    for (let video of videoElements) {
      if (
        video.srcObject &&
        video.srcObject
          .getTracks()
          .some((track) => track.id === consumer.track.id)
      ) {
        video.remove();
        break;
      }
    }
  }
});

// Функция публикации аудио и видео треков
async function publishLocalTracks() {
  if (!sendTransport || !localStream) return;

  try {
    // Публикация аудио дорожки
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      const audioProducer = await sendTransport.produce({ track: audioTrack });
      producers.push(audioProducer);
    }

    // Публикация видео дорожки
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      const videoProducer = await sendTransport.produce({ track: videoTrack });
      producers.push(videoProducer);
    }
  } catch (error) {
    console.error('Ошибка при публикации треков: ', error);
  }
}

// Функция добавления видеопотока в сетку
const addVideoStream = (video, stream) => {
  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
    videoGrid.append(video);
  });
};
/*
  Chat block
  ******************************************************************************************************************************
*/
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
/*
  Button-functionality block
  ******************************************************************************************************************************
*/
const showChat = document.querySelector('#showChat');
const backBtn = document.querySelector('.header__back');

const inviteButton = document.querySelector('#inviteButton');
const muteButton = document.querySelector('#muteButton');
const stopVideo = document.querySelector('#stopVideo');

let isChatExpanded = true;

backBtn.addEventListener('click', () => {
  document.querySelector('.main__left').style.display = 'flex';
  document.querySelector('.main__left').style.flex = '1';
  document.querySelector('.main__right').style.display = 'none';
  document.querySelector('.header_back').style.display = 'none';
});

showChat.addEventListener('click', () => {
  document.querySelector('.main__right').style.display = isChatExpanded
    ? 'none'
    : 'flex';
  document.querySelector('.main__left').style.flex = isChatExpanded
    ? '1.3'
    : '0.7';
  showChat.innerHTML = isChatExpanded
    ? '<i class="fas fa-comment"></i>'
    : '<i class="fa fa-comment-slash"></i>';
  isChatExpanded = !isChatExpanded;
});

inviteButton.addEventListener('click', () => {
  prompt('Скопируйте ссылку и отправьте ее другу:', window.location.href);
});

muteButton.addEventListener('click', () => {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      muteButton.innerHTML = audioTrack.enabled
        ? '<i class="fas fa-microphone"></i>'
        : '<i class="fas fa-microphone-slash"></i>';
      muteButton.classList.toggle('background__red');
    }
  }
});

stopVideo.addEventListener('click', () => {
  const isEnabled = localStream.getVideoTracks()[0].enabled;
  localStream.getVideoTracks()[0].enabled = !isEnabled;
  stopVideo.innerHTML = isEnabled
    ? '<i class="fas fa-video-slash"></i>'
    : '<i class="fas fa-video"></i>';
  stopVideo.classList.toggle('background__red');
});
