import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../../env.js';

export type WallMode = 'slideshow' | 'mosaic' | 'highlights' | 'latest';

export interface LiveState {
  mode: WallMode;
  playing: boolean;
  currentMomentId: string | null;
  highlightMomentId: string | null;
  updatedAt: string;
}

const liveStateByEvent = new Map<string, LiveState>();

function defaultState(): LiveState {
  return {
    mode: 'slideshow',
    playing: true,
    currentMomentId: null,
    highlightMomentId: null,
    updatedAt: new Date().toISOString(),
  };
}

export function getLiveState(eventId: string): LiveState {
  if (!liveStateByEvent.has(eventId)) {
    liveStateByEvent.set(eventId, defaultState());
  }
  return liveStateByEvent.get(eventId)!;
}

export function updateLiveState(eventId: string, patch: Partial<LiveState>): LiveState {
  const next = { ...getLiveState(eventId), ...patch, updatedAt: new Date().toISOString() };
  liveStateByEvent.set(eventId, next);
  return next;
}

let io: SocketIOServer | null = null;

export function initSocket(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    socket.on('event.join', (eventId: string) => {
      if (typeof eventId === 'string' && eventId.length > 0) {
        socket.join(`event:${eventId}`);
      }
    });

    socket.on('event.leave', (eventId: string) => {
      if (typeof eventId === 'string') {
        socket.leave(`event:${eventId}`);
      }
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export function emitToEvent(eventId: string, eventName: string, payload: unknown) {
  getIO().to(`event:${eventId}`).emit(eventName, payload);
}
