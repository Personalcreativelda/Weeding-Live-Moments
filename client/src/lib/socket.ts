import { io, type Socket } from 'socket.io-client';

// Same split as lib/api.ts: VITE_API_URL points Socket.IO at the VPS domain in
// production; left unset locally so it connects same-origin through the Vite proxy.
const API_ORIGIN = import.meta.env.VITE_API_URL || undefined;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_ORIGIN, {
      path: '/socket.io',
      withCredentials: true,
      autoConnect: true,
    });
  }
  return socket;
}

export function joinEventRoom(eventId: string) {
  getSocket().emit('event.join', eventId);
}

export function leaveEventRoom(eventId: string) {
  getSocket().emit('event.leave', eventId);
}
