import { io } from 'socket.io-client';

// The URL of your backend server
const URL = 'http://localhost:5000';

// Create the socket instance
// We use autoConnect: false so we can manually connect when a user joins a session.
export const socket = io(URL, {
  autoConnect: false
});