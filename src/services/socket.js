import { io } from 'socket.io-client';
import { getData } from '../storage/asyncStorage';
import { ASYNC_STORAGE_KEYS, SOCKET_URL } from '../utils/constants';

let socket = null;

function waitForConnection(activeSocket) {
  if (activeSocket.connected) {
    return Promise.resolve(activeSocket);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      activeSocket.off('connect', onConnect);
      activeSocket.off('connect_error', onError);
      reject(new Error('Socket connection timeout'));
    }, 10000);

    const onConnect = () => {
      clearTimeout(timeout);
      activeSocket.off('connect_error', onError);
      resolve(activeSocket);
    };

    const onError = (error) => {
      clearTimeout(timeout);
      activeSocket.off('connect', onConnect);
      reject(error);
    };

    activeSocket.once('connect', onConnect);
    activeSocket.once('connect_error', onError);
  });
}

export async function connectSocket() {
  if (socket?.connected) {
    return socket;
  }

  const token = await getData(ASYNC_STORAGE_KEYS.AUTH_TOKEN);
  if (!token) {
    return null;
  }

  if (socket) {
    socket.auth = { token };
    if (!socket.connected) {
      socket.connect();
    }
    try {
      await waitForConnection(socket);
    } catch (error) {
      console.error('Socket reconnect error:', error);
      return null;
    }
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    autoConnect: true,
  });

  try {
    await waitForConnection(socket);
  } catch (error) {
    console.error('Socket connect error:', error);
    return null;
  }

  return socket;
}

export function getSocket() {
  return socket;
}

export async function joinOrderRoom(orderId) {
  if (!orderId) {
    return;
  }

  const activeSocket = await connectSocket();
  if (!activeSocket) {
    return;
  }

  activeSocket.emit('join_order', String(orderId));
}

export function leaveOrderRoom() {
  if (!socket) {
    return;
  }
  socket.off('rider_location_updated');
  socket.off('order_updated');
}

export function disconnectSocket() {
  if (!socket) {
    return;
  }
  socket.disconnect();
  socket = null;
}

export function onRiderLocationUpdated(callback) {
  if (!socket) {
    return () => {};
  }

  const handler = (payload) => callback(payload);
  socket.on('rider_location_updated', handler);
  return () => socket.off('rider_location_updated', handler);
}

export function onOrderUpdated(callback) {
  if (!socket) {
    return () => {};
  }

  const handler = (payload) => callback(payload);
  socket.on('order_updated', handler);
  return () => socket.off('order_updated', handler);
}
