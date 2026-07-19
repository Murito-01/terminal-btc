import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected]     = useState(false);
  const [latestSignal, setLatestSignal] = useState(null);
  // State terkini dari Signal Engine (termasuk WAIT per timeframe)
  const [liveState, setLiveState]     = useState(null);

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

    // Sinyal baru LONG/SHORT yang tersimpan ke database
    socketRef.current.on('new_signal', (signal) => {
      console.log('📡 New signal received:', signal);
      setLatestSignal(signal);
    });

    // Update state langsung dari Signal Engine setiap 1 menit (termasuk WAIT)
    socketRef.current.on('state_update', (state) => {
      setLiveState(state);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return { connected, latestSignal, liveState, socket: socketRef.current };
}
