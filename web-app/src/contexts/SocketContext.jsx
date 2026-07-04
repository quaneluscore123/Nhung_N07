import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SOCKET_URL = 'http://localhost:3000';
const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!user || !token) return;

    const newSocket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });

    newSocket.on('connect', () => {
      console.log('[WS] Connected to server');
      newSocket.emit('register_user', { userId: user._id });
    });

    newSocket.on('notification', (data) => {
      console.log('[WS] Notification:', data);
      addNotification(data);
    });

    newSocket.on('order_updated', (data) => {
      console.log('[WS] Order updated:', data);
      window.dispatchEvent(new CustomEvent('order_updated', { detail: data }));
    });

    newSocket.on('disconnect', () => {
      console.log('[WS] Disconnected from server');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user, token]);

  const addNotification = useCallback((notification) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { ...notification, id }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <SocketContext.Provider value={{ socket, notifications, addNotification, removeNotification }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within SocketProvider');
  return context;
}
