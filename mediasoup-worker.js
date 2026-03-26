const mediasoup = require('mediasoup');

module.exports.worker;
module.exports.rooms = new Map(); // Хранилище комнат: roomId -> { router, producers, consumers, transports, sockets }

// Создание Worker
(async () => {
  worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
    // dtlsCertificateFile: 'certs/localhost+2.pem',
    // dtlsPrivateKeyFile: 'certs/localhost+2-key.pem',
  });
  console.log('MediaSoup Worker запущен...');
})();

// Создание комнаты (router)
module.exports.createRoom = async (roomId) => {
  if (rooms.has(roomId)) {
    return rooms.get(roomId).router;
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

// Удаление комнаты (router)
module.exports.cleanupRoom = (roomId) => {
  const room = rooms.get(roomId);
  if (room && room.sockets.size === 0) {
    rooms.delete(roomId);
    console.log(`Комната ${roomId} удалена (пуста).`);
  }
};
