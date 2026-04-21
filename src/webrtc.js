import { Device } from 'mediasoup-client';

// Экспортируемое состояние
export let device = null;
export let sendTransport = null;
export let recvTransport = null;
export let localStream = null;
export let producers = [];
export let consumers = new Map();

// Элементы интерфейса
const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');

// Получение локального медиапотока
export const localStreamPromise = navigator.mediaDevices
  ? navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: true,
      })
      .then((stream) => {
        localStream = stream;
        addVideoStream(myVideo, stream);
        return stream;
      })
      .catch((error) => {
        console.error('Ошибка доступа к медиаустройствам: ', error);
        alert(
          'Не удалось получить доступ к камере/микрофону. Проверьте разрешения.',
        );
        return null;
      })
  : Promise.resolve(null);

// Функция добавления видеопотока в сетку
export const addVideoStream = (video, stream, producerId = null) => {
  // Проверяем, что поток существует и содержит видео-треки
  if (!stream || stream.getVideoTracks().length === 0) {
    console.warn('Поток не содержит видео-треков, видео не будет добавлено.');
    return;
  }

  // Если передан producerId, удаляем старый контейнер с таким же идентификатором
  if (producerId) {
    const oldContainer = videoGrid.querySelector(
      `.video-container[data-producer-id="${producerId}"]`,
    );
    if (oldContainer) {
      // Если старый контейнер содержит это же видео, не удаляем
      if (!oldContainer.contains(video)) {
        oldContainer.remove();
      }
    }
  }

  // Проверяем, не добавлено ли уже это видео в сетку
  const existingContainer = video.closest('.video-container');
  if (existingContainer && videoGrid.contains(existingContainer)) {
    // Видео уже в сетке, обновляем srcObject
    video.srcObject = stream;
    return;
  }

  video.srcObject = stream;
  video.addEventListener('loadedmetadata', () => {
    video.play();
    // Создаём контейнер для видео
    const container = document.createElement('div');
    container.className = 'video-container';
    if (producerId) {
      container.setAttribute('data-producer-id', producerId);
    }
    container.appendChild(video);
    videoGrid.appendChild(container);
  });
};

// Функция публикации аудио и видео треков
export async function publishLocalTracks() {
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

// Инициализация WebRTC модуля
export function initWebRTC(socket, user, ROOM_ID) {
  // Коннект к комнате после получения потока
  socket.on('connect', () => {
    if (!ROOM_ID) {
      console.error('Не могу подключиться: ROOM_ID отсутствует');
      return;
    }
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

        // Ожидание готовности локального потока перед публикацией
        const stream = await localStreamPromise;
        if (stream) {
          // Публикация локальных треков
          await publishLocalTracks();
        } else {
          console.warn('Локальный поток не доступен, пропускаем публикацию.');
        }
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
      addVideoStream(
        remoteVideo,
        new MediaStream([consumer.track]),
        producerId,
      );

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
      // Находим соответствующий контейнер с видео по data-producer-id и удаляем его
      const container = videoGrid.querySelector(
        `.video-container[data-producer-id="${producerId}"]`,
      );
      if (container) {
        container.remove();
      }
    }
  });
}
