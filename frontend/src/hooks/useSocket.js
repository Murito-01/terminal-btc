import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected]       = useState(false);
  const [latestSignal, setLatestSignal] = useState(null);
  const [liveState, setLiveState]       = useState(null);
  // Waktu update berikutnya dari Signal Engine
  const [nextUpdateAt, setNextUpdateAt] = useState(null);

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

    // Update state langsung dari Signal Engine setiap 15 menit (termasuk WAIT)
    socketRef.current.on('state_update', (data) => {
      // Pisahkan metadata dari state timeframe
      const { _meta, ...timeframeStates } = data;
      setLiveState(timeframeStates);
      if (_meta?.next_update_at) {
        setNextUpdateAt(_meta.next_update_at);
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return { connected, latestSignal, liveState, nextUpdateAt, socket: socketRef.current };
}
