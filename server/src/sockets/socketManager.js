import { Server } from 'socket.io';
import { env } from '../config/env.js';

let ioInstance = null;

export function initSocketIO(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => callback(null, true),
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  ioInstance.on('connection', (socket) => {
    // Join specific auction room
    socket.on('auction:join', (listingId) => {
      if (typeof listingId === 'string' && listingId.trim()) {
        socket.join(`auction:${listingId}`);
      }
    });

    // Leave specific auction room
    socket.on('auction:leave', (listingId) => {
      if (typeof listingId === 'string' && listingId.trim()) {
        socket.leave(`auction:${listingId}`);
      }
    });

    // Join authenticated user's private notification channel
    socket.on('user:join', (userId) => {
      if (typeof userId === 'string' && userId.trim()) {
        socket.join(`user:${userId}`);
      }
    });
  });

  console.log('✅ Socket.IO initialized and ready.');
  return ioInstance;
}

export function getIO() {
  return ioInstance;
}

export function emitAuctionUpdate(listingId, event, data) {
  if (ioInstance) {
    ioInstance.to(`auction:${listingId}`).emit(event, data);
  }
}

export function emitUserUpdate(userId, event, data) {
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit(event, data);
  }
}
