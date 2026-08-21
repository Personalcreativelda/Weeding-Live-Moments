import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import type { AdminUser, WeddingEvent } from '@/types';

interface AdminEventSummary {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

interface AdminContextValue {
  user: AdminUser | null;
  loading: boolean;
  events: AdminEventSummary[];
  currentEventId: string | null;
  setCurrentEventId: (id: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshEvents: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<AdminEventSummary[]>([]);
  const [currentEventId, setCurrentEventId] = useState<string | null>(null);

  const refreshEvents = useCallback(async () => {
    const list = await api.get<AdminEventSummary[]>('/events');
    setEvents(list);
    setCurrentEventId((prev) => prev ?? list[0]?.id ?? null);
  }, []);

  useEffect(() => {
    api
      .get<AdminUser>('/auth/me')
      .then(async (me) => {
        setUser(me);
        await refreshEvents();
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [refreshEvents]);

  const login = useCallback(
    async (email: string, password: string) => {
      const me = await api.post<AdminUser>('/auth/login', { email, password });
      setUser(me);
      await refreshEvents();
    },
    [refreshEvents]
  );

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    setUser(null);
    setEvents([]);
    setCurrentEventId(null);
  }, []);

  const value = useMemo<AdminContextValue>(
    () => ({ user, loading, events, currentEventId, setCurrentEventId, login, logout, refreshEvents }),
    [user, loading, events, currentEventId, login, logout, refreshEvents]
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}

export type { AdminEventSummary, WeddingEvent };
