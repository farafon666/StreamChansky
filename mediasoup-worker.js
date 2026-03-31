import mediasoup from 'mediasoup';

export const rooms = new Map(); // Хранилище комнат: roomId -> { router, producers, consumers, transports, sockets }
export let worker = null;

/**
 * Инициализация Worker
 */
(async () => {
  try {
    worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
      dtlsCertificateFile: 'certs/localhost+2.pem',
      dtlsPrivateKeyFile: 'certs/localhost+2-key.pem',
    });
    console.log('MediaSoup Worker запущен...');
  } catch (err) {
    console.error('Не удалось запустить MediaSoup Worker:', err);
  }
})();

/**
 * Создаёт комнату (router) для указанного идентификатора.
 * @param {string} roomId - Идентификатор комнаты.
 * @returns {Promise<import('mediasoup').Router>} Роутер комнаты.
 * @throws {Error} Если worker ещё не инициализирован.
 */
export const createRoom = async (roomId) => {
  if (rooms.has(roomId)) {
    return rooms.get(roomId).router;
  }

  if (!worker) {
    throw new Error('MediaSoup worker not initialized yet');
  }

  const router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
    ],
  });

  rooms.set(roomId, {
    router,
    producers: new Map(), // producerId -> producer
    consumers: new Map(), // consumerId -> consumer (для быстрого resume)
    transports: new Map(), // socketId -> { sendTransport, recvTransport }
    sockets: new Set(), // socketId
  });

  console.log(`Комната "${roomId}" создана.`);
  return router;
};

/**
 * Удаляет комнату, если в ней нет активных сокетов.
 * @param {string} roomId - Идентификатор комнаты.
 */
export const cleanupRoom = (roomId) => {
  const room = rooms.get(roomId);
  if (room && room.sockets.size === 0) {
    rooms.delete(roomId);
    console.log(`Комната ${roomId} удалена (пуста).`);
  }
};
