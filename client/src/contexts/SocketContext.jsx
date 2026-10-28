import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { mongoUser } = useAuth();

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      if (mongoUser?.id) {
        socketInstance.emit('user:join', mongoUser.id);
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
    if (socket && isConnected && mongoUser?.id) {
      socket.emit('user:join', mongoUser.id);
    }
  }, [socket, isConnected, mongoUser?.id]);

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
