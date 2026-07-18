import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [latestSignal, setLatestSignal] = useState(null);

  useEffect(() => {
    socketRef.current = io('/', {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current.on('connect', () => {
      setConnected(true);
      console.log('🔌 WebSocket connected');
    });

    socketRef.current.on('disconnect', () => {
      setConnected(false);
      console.log('🔌 WebSocket disconnected');
    });

    socketRef.current.on('new_signal', (signal) => {
      console.log('📡 New signal received:', signal);
      setLatestSignal(signal);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return { connected, latestSignal, socket: socketRef.current };
}
