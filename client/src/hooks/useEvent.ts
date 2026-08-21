import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import type { WeddingEvent } from '@/types';

interface UseEventResult {
  event: WeddingEvent | null;
  loading: boolean;
  error: string | null;
}

export function useEvent(slug: string | undefined): UseEventResult {
  const [event, setEvent] = useState<WeddingEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    api
      .get<WeddingEvent>(`/events/by-slug/${slug}`)
      .then((data) => {
        if (!cancelled) setEvent(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setError('Evento não encontrado.');
        } else {
          setError('Não foi possível carregar o evento.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { event, loading, error };
}
