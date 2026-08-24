import { useEffect, useState } from 'react';
import { Star, X, Play } from 'lucide-react';
import { useAdmin } from '@/context/AdminContext';
import { useEventRoom } from '@/hooks/useEventRoom';
import { api } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Moment } from '@/types';

export function GalleryManagePage() {
  const { currentEventId } = useAdmin();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  function refresh() {
    if (!currentEventId) return;
    api
      .get<Moment[]>(`/events/${currentEventId}/moments?status=approved`)
      .then(setMoments)
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [currentEventId]);
  useEventRoom(currentEventId ?? undefined, {
    'moment.approved': (moment: Moment) => setMoments((prev) => [moment, ...prev]),
  });

  async function highlight(id: string) {
    setHighlightId(id);
    await api.patch(`/moments/${id}/highlight`);
  }

  async function reject(id: string) {
    setMoments((prev) => prev.filter((m) => m.id !== id));
    await api.patch(`/moments/${id}/reject`);
  }

  if (loading) return <LoadingSpinner label="A carregar galeria..." />;

  return (
    <div>
      <h1 className="font-serif text-2xl">Galeria</h1>
      <p className="mt-1 text-sm text-ink/50">Momentos aprovados. Destaque um para mostrar imediatamente na tela.</p>

      {moments.length === 0 ? (
        <EmptyState icon={Star} title="Ainda sem momentos aprovados" />
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {moments.map((moment) => (
            <div key={moment.id} className="group relative overflow-hidden rounded-2xl border border-gold/20 bg-white">
              <div className="relative">
                <img src={moment.thumbnailUrl} alt="" className="aspect-square w-full object-cover" />
                {moment.mediaType === 'video' && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                    <Play className="h-6 w-6 fill-white text-white drop-shadow" />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-2">
                <button
                  onClick={() => highlight(moment.id)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium ${
                    highlightId === moment.id ? 'bg-gold text-white' : 'bg-blush text-gold-dark'
                  }`}
                >
                  <Star className="h-3.5 w-3.5" /> Destacar
                </button>
                <button onClick={() => reject(moment.id)} className="rounded-full p-1.5 text-ink/40 hover:text-red-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
