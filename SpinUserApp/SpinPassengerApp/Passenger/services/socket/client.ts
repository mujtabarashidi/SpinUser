import { io, Socket } from 'socket.io-client';

const DEFAULT_SOCKET_URL = 'https://spintaxi-realtime-server-production.up.railway.app';
const SOCKET_URL =
  process.env.SPIN_TAXI_SOCKET_URL ||
  process.env.SOCKET_SERVER_URL ||
  DEFAULT_SOCKET_URL;

const socket: Socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'], // Lägg till polling som fallback
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  timeout: 20000, // Öka timeout från 10s till 20s
  forceNew: true,
});

// Add connection event logging for debugging
socket.on('connect', () => {
  console.log('🟢 [Socket.IO] Connected to server:', SOCKET_URL);
});

socket.on('disconnect', (reason: string) => {
  console.log('🔴 [Socket.IO] Disconnected from server. Reason:', reason);
});

socket.on('connect_error', (error: Error) => {
  // Only log in development to avoid red error screens in production
  if (__DEV__) {
    console.warn('⚠️ [Socket.IO] Connection error:', error.message);
  }
});

socket.on('error', (error: any) => {
  // Only log in development to avoid red error screens in production
  if (__DEV__) {
    console.warn('⚠️ [Socket.IO] Error:', error);
  }
});

export const ensureSocketConnected = (): Promise<void> => {
  return new Promise((resolve) => {
    // Already connected
    if (socket.connected) {
      console.log('✅ [Socket] Already connected');
      return resolve();
    }

    // Not connected but connected before (just reconnecting)
    if (!socket.disconnected) {
      console.log('⏳ [Socket] Connecting...');
      return resolve();
    }

    // Fully disconnected, initiate connection
    console.log('🔌 [Socket] Initiating connection...');
    socket.connect();

    // Wait for connection to complete (max 5 seconds)
    const timeoutId = setTimeout(() => {
      console.log('⏱️ [Socket] Connection timeout after 5s, continuing anyway');
      resolve();
    }, 5000);

    socket.once('connect', () => {
      clearTimeout(timeoutId);
      console.log('🟢 [Socket] Connected!');
      resolve();
    });
  });
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};

export const getSocketUrl = () => SOCKET_URL;

export default socket;
