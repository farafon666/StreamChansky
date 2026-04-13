import {
  rooms,
  createRoom as mediasoupCreateRoom,
  cleanupRoom,
} from '../mediasoup-worker.js';

/**
 * Получить комнату по идентификатору.
 * @param {string} roomId
 * @returns {object|null} Объект комнаты или null, если не существует.
 */
export function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

/**
 * Создать комнату (роутер) для указанного идентификатора.
 * @param {string} roomId
 * @returns {Promise<import('mediasoup').Router>} Роутер комнаты.
 */
export async function createRoom(roomId) {
  return await mediasoupCreateRoom(roomId);
}

/**
 * Удалить комнату, если она пуста.
 * @param {string} roomId
 */
export function deleteRoom(roomId) {
  cleanupRoom(roomId);
}

/**
 * Добавить сокет в комнату.
 * @param {string} roomId
 * @param {string} socketId
 */
export function addSocketToRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  if (room) {
    room.sockets.add(socketId);
  }
}

/**
 * Удалить сокет из комнаты.
 * @param {string} roomId
 * @param {string} socketId
 */
export function removeSocketFromRoom(roomId, socketId) {
  const room = rooms.get(roomId);
  if (room) {
    room.sockets.delete(socketId);
  }
}

/**
 * Получить все комнаты (для отладки).
 * @returns {Map}
 */
export function getAllRooms() {
  return rooms;
}
