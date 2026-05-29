import { Device } from 'mediasoup-client';

// Экспортируемое состояние
export let device = null;
export let sendTransport = null;
export let recvTransport = null;
export let localStream = null;
export let producers = [];
export let consumers = new Map();

// Socket.IO соединение
export let socket = null;

// Демонстрация экрана
export let screenStream = null;
export let screenProducer = null;

// Видеопоток с камеры
export let videoProducer = null;

// Элементы интерфейса
export const videoMainContainer = document.getElementById(
  'video-main-container',
);
const thumbnailsContainer = document.querySelector('.thumbnails-container');
const myVideo = document.createElement('video');
myVideo.muted = true;

// Управление миниатюрами и выбранным потоком
let selectedProducerId = null;
const thumbnailMap = new Map(); // producerId -> {thumbnail, mainVideo, userName}
let currentUserName = 'Me';

// Получение локального медиапотока
export const localStreamPromise = navigator.mediaDevices
  ? navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: false,
      })
      .then((stream) => {
        localStream = stream;
        addVideoStream(stream, null, currentUserName);
        return stream;
      })
      .catch((error) => {
        console.error('Ошибка доступа к медиаустройствам: ', error);
        alert('Не удалось получить доступ к микрофону. Проверьте разрешения.');
        return null;
      })
  : Promise.resolve(null);

// Создание миниатюры
function createThumbnail(stream, producerId, userName = 'Участник') {
  const thumbnail = document.createElement('div');
  thumbnail.className = 'video-thumbnail';
  thumbnail.dataset.producerId = producerId;

  const hasVideo = stream.getVideoTracks().length > 0;
  let mediaElement;

  if (hasVideo) {
    // Создаём видео элемент
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    video.muted = true;
    video.playsinline = true;
    mediaElement = video;
    thumbnail.dataset.hasVideo = 'true';
  } else {
    // Создаём placeholder с именем пользователя
    const placeholder = document.createElement('div');
    placeholder.className = 'thumbnail-placeholder';
    placeholder.textContent = userName.charAt(0).toUpperCase(); // Первая буква имени
    placeholder.title = userName;
    mediaElement = placeholder;
    thumbnail.dataset.hasVideo = 'false';
  }

  const info = document.createElement('div');
  info.className = 'thumbnail-info';
  info.innerHTML = `
    <span class="thumbnail-name">${userName}</span>
    <i class="fas fa-microphone thumbnail-audio-indicator"></i>
  `;

  thumbnail.appendChild(mediaElement);
  thumbnail.appendChild(info);

  // Обработчик клика для выбора потока
  thumbnail.addEventListener('click', () => {
    selectStream(producerId);
  });

  if (thumbnailsContainer) {
    thumbnailsContainer.appendChild(thumbnail);
  }

  return thumbnail;
}

// Выбор потока для отображения в main-container
function selectStream(producerId) {
  // Снять выделение с предыдущей миниатюры
  if (selectedProducerId) {
    const prev = thumbnailMap.get(selectedProducerId);
    if (prev && prev.thumbnail) {
      prev.thumbnail.classList.remove('selected');
    }
  }

  // Установить новое выделение
  selectedProducerId = producerId;
  const current = thumbnailMap.get(producerId);

  if (current && videoMainContainer) {
    current.thumbnail.classList.add('selected');

    // Очистить main-container и добавить выбранное видео
    videoMainContainer.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'video-container';

    // Используем существующий mainVideo или создаем новый
    let mainVideo = current.mainVideo;
    if (!mainVideo) {
      mainVideo = document.createElement('video');
      mainVideo.srcObject = current.stream;
      mainVideo.autoplay = true;
      mainVideo.playsinline = true;
      mainVideo.className = 'main-video';
      current.mainVideo = mainVideo;
    }

    // Если выбран локальный поток — отключаем звук, чтобы избежать эха
    mainVideo.muted = current.stream === localStream;

    container.appendChild(mainVideo);
    videoMainContainer.appendChild(container);

    // Обновить аудио индикатор
    updateAudioIndicator(producerId);
  }
}

// Обновление индикатора аудио на миниатюре
function updateAudioIndicator(producerId) {
  const data = thumbnailMap.get(producerId);
  if (!data || !data.thumbnail) return;

  const indicator = data.thumbnail.querySelector('.thumbnail-audio-indicator');
  if (!indicator) return;
}

// Функция добавления видеопотока
export const addVideoStream = (
  stream,
  producerId = null,
  userName = 'Участник',
) => {
  // Проверяем, что поток существует и содержит хотя бы один трек (аудио или видео)
  if (!stream || stream.getTracks().length === 0) {
    console.warn('Поток не содержит треков, не будет добавлен.');
    return;
  }

  if (!producerId) {
    return;
  }

  // Создание миниатюры
  if (thumbnailsContainer) {
    // Проверяем, не существует ли уже миниатюра для этого producerId
    if (!thumbnailMap.has(producerId)) {
      const thumbnail = createThumbnail(stream, producerId, userName);
      const mainVideo = document.createElement('video');
      mainVideo.srcObject = stream;
      mainVideo.autoplay = true;
      mainVideo.playsinline = true;
      mainVideo.className = 'main-video';
      // Отключаем звук для локального потока, чтобы избежать эха
      mainVideo.muted = stream === localStream;

      thumbnailMap.set(producerId, {
        thumbnail,
        mainVideo,
        stream,
        userName,
        hasVideo: stream.getVideoTracks().length > 0,
      });

      // Если это первый поток, выбираем его по умолчанию
      if (thumbnailMap.size === 1 && !selectedProducerId) {
        selectStream(producerId);
      }
    } else {
      // Обновляем существующую миниатюру
      const data = thumbnailMap.get(producerId);
      if (data && data.thumbnail) {
        const hasVideo = stream.getVideoTracks().length > 0;
        const oldHasVideo = data.hasVideo;

        // Если тип потока изменился (появилось или исчезло видео), пересоздаём миниатюру
        if (hasVideo !== oldHasVideo) {
          // Удаляем старую миниатюру
          data.thumbnail.remove();
          // Создаём новую миниатюру
          const newThumbnail = createThumbnail(stream, producerId, userName);
          data.thumbnail = newThumbnail;
          data.hasVideo = hasVideo;
          // Обновляем mainVideo
          if (data.mainVideo) {
            data.mainVideo.srcObject = stream;
          }
        } else {
          // Тип не изменился, просто обновляем источник
          const mediaElement = data.thumbnail.querySelector(
            'video, .thumbnail-placeholder',
          );
          if (mediaElement && mediaElement.tagName === 'VIDEO') {
            mediaElement.srcObject = stream;
          }
          // Обновляем mainVideo если он существует
          if (data.mainVideo) {
            data.mainVideo.srcObject = stream;
          }
        }
        // Обновляем имя пользователя в info
        const nameSpan = data.thumbnail.querySelector('.thumbnail-name');
        if (nameSpan) {
          nameSpan.textContent = userName;
        }
        data.userName = userName;
        data.stream = stream;
      }
    }
  }
};

// Функция публикации аудио и видео треков
export let audioProducer = null;

export async function publishLocalTracks() {
  if (!sendTransport || !localStream) return;

  try {
    // Публикация аудио дорожки
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioProducer = await sendTransport.produce({ track: audioTrack });
      producers.push(audioProducer);

      // Добавляем миниатюру для локального потока с producerId аудио
      addVideoStream(localStream, audioProducer.id, currentUserName);
    }
  } catch (error) {
    console.error('Ошибка при публикации треков: ', error);
  }
}

// Инициализация WebRTC модуля
export function initWebRTC(incomingSocket, user, ROOM_ID) {
  // Сохраняем socket в модульную переменную
  socket = incomingSocket;
  // Сохраняем имя пользователя
  currentUserName = user || 'Me';
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

      remoteVideo.muted = false;
      remoteVideo.setAttribute('playsinline', '');
      remoteVideo.setAttribute('autoplay', '');

      addVideoStream(new MediaStream([consumer.track]), producerId, 'Участник');

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
    }

    // Удаление миниатюры
    const thumbnailData = thumbnailMap.get(producerId);
    if (thumbnailData && thumbnailData.thumbnail) {
      thumbnailData.thumbnail.remove();
    }
    thumbnailMap.delete(producerId);

    // Если удалён выбранный поток, выбрать другой
    if (selectedProducerId === producerId) {
      const firstId = Array.from(thumbnailMap.keys())[0];
      if (firstId) {
        selectStream(firstId);
      } else {
        // Показать placeholder
        if (videoMainContainer) {
          videoMainContainer.innerHTML = `
            <div class="video-main-placeholder">
              <i class="fas fa-video"></i>
              <p>Выберите поток для просмотра</p>
            </div>
          `;
        }
        selectedProducerId = null;
      }
    }
  });
}

// Публикация трека демонстрации экрана
export async function publishScreenTrack(track) {
  if (!sendTransport) {
    console.error('sendTransport не инициализирован');
    return;
  }

  try {
    // Создаём продюсера для трека экрана
    screenProducer = await sendTransport.produce({ track });
    producers.push(screenProducer);

    // Создаём поток для отображения локального экрана
    const stream = new MediaStream([track]);
    const screenVideo = document.createElement('video');
    screenVideo.muted = true;
    screenVideo.setAttribute('playsinline', '');
    screenVideo.setAttribute('autoplay', '');
    addVideoStream(stream, screenProducer.id, `${currentUserName} (Экран)`);

    // Сохраняем поток для последующей остановки
    screenStream = stream;
  } catch (error) {
    console.error('Ошибка публикации трека экрана:', error);
  }
}

// Остановка демонстрации экрана
export async function stopScreenTrack() {
  if (screenProducer) {
    try {
      // Отправляем событие закрытия продюсера на сервер
      if (socket) {
        socket.emit(
          'close-producer',
          { producerId: screenProducer.id },
          (response) => {
            if (response && response.error) {
              console.warn(
                'Сервер вернул ошибку при закрытии продюсера:',
                response.error,
              );
            }
          },
        );
      } else {
        console.warn(
          'Socket не инициализирован, закрываем продюсера локально.',
        );
      }

      // Закрываем продюсера локально
      screenProducer.close();
      // Удаляем из массива producers
      const index = producers.indexOf(screenProducer);
      if (index > -1) {
        producers.splice(index, 1);
      }

      // Удаляем миниатюру экрана
      const thumbnailData = thumbnailMap.get(screenProducer.id);
      if (thumbnailData && thumbnailData.thumbnail) {
        thumbnailData.thumbnail.remove();
      }
      thumbnailMap.delete(screenProducer.id);

      // Если выбранный поток был экраном, выбираем другой
      if (selectedProducerId === screenProducer.id) {
        const firstId = Array.from(thumbnailMap.keys())[0];
        if (firstId) {
          selectStream(firstId);
        } else {
          if (videoMainContainer) {
            videoMainContainer.innerHTML = `
              <div class="video-main-placeholder">
                <i class="fas fa-video"></i>
                <p>Выберите поток для просмотра</p>
              </div>
            `;
          }
          selectedProducerId = null;
        }
      }

      screenProducer = null;
    } catch (error) {
      console.error('Ошибка при остановке продюсера экрана:', error);
    }
  }

  if (screenStream) {
    screenStream.getTracks().forEach((track) => track.stop());
    screenStream = null;
  }
}

// Остановка видеопотока с камеры
export async function stopVideoTrack() {
  if (videoProducer) {
    try {
      // Отправляем событие закрытия продюсера на сервер
      if (socket) {
        socket.emit(
          'close-producer',
          { producerId: videoProducer.id },
          (response) => {
            if (response && response.error) {
              console.warn(
                'Сервер вернул ошибку при закрытии продюсера:',
                response.error,
              );
            }
          },
        );
      } else {
        console.warn(
          'Socket не инициализирован, закрываем продюсера локально.',
        );
      }

      // Закрываем продюсера локально
      videoProducer.close();
      // Удаляем из массива producers
      const index = producers.indexOf(videoProducer);
      if (index > -1) {
        producers.splice(index, 1);
      }

      // Удаляем видеотрек из localStream
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        localStream.removeTrack(videoTrack);
        videoTrack.stop();
      }

      // Удаляем миниатюру видео
      const thumbnailData = thumbnailMap.get(videoProducer.id);
      if (thumbnailData && thumbnailData.thumbnail) {
        thumbnailData.thumbnail.remove();
      }
      thumbnailMap.delete(videoProducer.id);

      // Если выбранный поток был видео, выбираем другой
      if (selectedProducerId === videoProducer.id) {
        const firstId = Array.from(thumbnailMap.keys())[0];
        if (firstId) {
          selectStream(firstId);
        } else {
          if (videoMainContainer) {
            videoMainContainer.innerHTML = `
              <div class="video-main-placeholder">
                <i class="fas fa-video"></i>
                <p>Выберите поток для просмотра</p>
              </div>
            `;
          }
          selectedProducerId = null;
        }
      }

      // Создаём миниатюру для аудио (placeholder)
      if (audioProducer && localStream) {
        addVideoStream(localStream, audioProducer.id, currentUserName);
      }

      videoProducer = null;
    } catch (error) {
      console.error('Ошибка при остановке продюсера видео:', error);
    }
  }
}

// Включение видеопотока с камеры
export async function startVideoTrack() {
  if (!sendTransport || !localStream) {
    console.warn('sendTransport или localStream не инициализированы');
    return;
  }

  // Проверяем, есть ли уже видеотрек в localStream
  let videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) {
    // Запрашиваем камеру (только видео, аудио уже есть)
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      videoTrack = videoStream.getVideoTracks()[0];
      if (!videoTrack) {
        throw new Error('Не удалось получить видеотрек с камеры');
      }
      // Добавляем видеотрек в существующий localStream
      localStream.addTrack(videoTrack);
    } catch (error) {
      console.error('Ошибка доступа к камере:', error);
      throw error;
    }
  }

  // Проверяем состояние трека
  if (videoTrack.readyState !== 'live') {
    console.warn('Видеотрек не в состоянии "live", пытаемся перезапустить');
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) {
        throw new Error('Не удалось получить новый видеотрек');
      }

      // Заменяем старый видеотрек в localStream
      const oldVideoTrack = localStream.getVideoTracks()[0];
      if (oldVideoTrack) {
        localStream.removeTrack(oldVideoTrack);
        if (oldVideoTrack.readyState === 'live') {
          oldVideoTrack.stop();
        }
      }
      localStream.addTrack(newVideoTrack);
      videoTrack = newVideoTrack;
    } catch (error) {
      console.error('Ошибка перезапуска камеры:', error);
      throw error;
    }
  }

  if (videoProducer) {
    console.warn('Видеопродюсер уже существует');
    return;
  }

  try {
    // Включаем видеотрек
    videoTrack.enabled = true;

    // Создаём продюсера для видео
    videoProducer = await sendTransport.produce({ track: videoTrack });
    producers.push(videoProducer);

    // Удаляем старую миниатюру аудио и добавляем новую с видео
    if (audioProducer && thumbnailMap.has(audioProducer.id)) {
      const audioThumbData = thumbnailMap.get(audioProducer.id);
      if (audioThumbData && audioThumbData.thumbnail) {
        audioThumbData.thumbnail.remove();
      }
      thumbnailMap.delete(audioProducer.id);
    }

    // Добавляем миниатюру для локального видео с producerId видеопродюсера
    addVideoStream(localStream, videoProducer.id, currentUserName);
  } catch (error) {
    console.error('Ошибка при создании видеопродюсера:', error);
    // Если ошибка связана с завершённым треком - сбросим videoProducer
    if (error.message.includes('ended') || error.name === 'InvalidStateError') {
      videoProducer = null;
    }
    // Пробрасываем ошибку дальше, чтобы UI мог отреагировать
    throw error;
  }
}
