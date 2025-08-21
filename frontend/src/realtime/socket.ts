import { io } from 'socket.io-client';

let _socket: any;

export function getSocket() {
  if (!_socket) {
    _socket = io(import.meta.env.VITE_WS_URL, {
      transports: ['websocket'],
    });
  }
  return _socket;
}
