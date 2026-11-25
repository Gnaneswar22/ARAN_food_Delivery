import { io } from 'socket.io-client';
import { getAccessToken } from './api';

let socket;
/** Lazily connect; auth token is read at connect time. Call resetSocket() on login/logout. */
export function getSocket() {
  if (!socket) socket = io(import.meta.env.VITE_API_URL || '/', { auth: (cb) => cb({ token: getAccessToken() }), transports: ['websocket', 'polling'], reconnectionDelayMax: 10000 });
  return socket;
}
export function resetSocket() { socket?.disconnect(); socket = undefined; }
