import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';
import { showDesktopNotification } from '../services/desktopNotifications.js';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { mongoUser } = useAuth();

  const userId = mongoUser?.id || mongoUser?._id;

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      if (userId) {
        socketInstance.emit('user:join', userId.toString());
      }
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  useEffect(() => {
    if (socket && isConnected && userId) {
      socket.emit('user:join', userId.toString());
    }
  }, [socket, isConnected, userId]);

  // Listen for live user notifications and dispatch desktop OS alerts
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewNotification = (notif) => {
      showDesktopNotification({
        type: notif.type,
        body: notif.message,
        listingId: notif.listingId,
        saleId: notif.saleId,
        tag: `notif_${notif.id || Date.now()}`,
        playSound: true,
      });
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [socket, isConnected]);

  const joinAuction = (listingId) => {
    if (socket && isConnected && listingId) {
      socket.emit('auction:join', listingId);
    }
  };

  const leaveAuction = (listingId) => {
    if (socket && isConnected && listingId) {
      socket.emit('auction:leave', listingId);
    }
  };

  return (
    <SocketContext.Provider value={{ socket, isConnected, joinAuction, leaveAuction }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
