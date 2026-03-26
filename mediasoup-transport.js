// Создание WebRTC транспорта
module.exports.createWebRtcTransport = async (
  router,
  listenIp = '127.0.0.1',
) => {
  const transport = await router.createWebRtcTransport({
    listenIps: [{ ip: listenIp, announcedIp: listenIp }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1000000,
  });
  return transport;
};
