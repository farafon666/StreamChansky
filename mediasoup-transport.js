/**
 * Создаёт WebRTC транспорт для указанного роутера.
 * @param {import('mediasoup').Router} router - Роутер Mediasoup.
 * @param {string} [listenIp='127.0.0.1'] - IP‑адрес для прослушивания.
 * @returns {Promise<import('mediasoup').WebRtcTransport>} Объект транспорта.
 * @throws {Error} Если не удалось создать транспорт.
 */
export const createWebRtcTransport = async (router, listenIp = '127.0.0.1') => {
  try {
    const transport = await router.createWebRtcTransport({
      listenIps: [{ ip: listenIp, announcedIp: listenIp }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 1_000_000, // 1 Mbps
    });
    return transport;
  } catch (error) {
    console.error('Ошибка создания WebRTC транспорта: ', error.message);
    throw new Error(`Не удалось создать WebRTC транспорт: ${error.message}`);
  }
};
