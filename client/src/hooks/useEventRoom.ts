import { useEffect } from 'react';
import { getSocket, joinEventRoom, leaveEventRoom } from '@/lib/socket';

/** Joins the event's socket room for the lifetime of the component and wires up listeners. */
export function useEventRoom(eventId: string | undefined, handlers: Record<string, (...args: any[]) => void>) {
  useEffect(() => {
    if (!eventId) return;
    const socket = getSocket();
    joinEventRoom(eventId);

    for (const [name, handler] of Object.entries(handlers)) {
      socket.on(name, handler);
    }

    return () => {
      for (const [name, handler] of Object.entries(handlers)) {
        socket.off(name, handler);
      }
      leaveEventRoom(eventId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);
}
