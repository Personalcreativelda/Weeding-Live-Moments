import { useEffect, useState } from 'react';
import { Star, X, Play, Download } from 'lucide-react';
import { useAdmin } from '@/context/AdminContext';
import { useEventRoom } from '@/hooks/useEventRoom';
import { api, apiUrl } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Moment } from '@/types';

export function GalleryManagePage() {
  const { currentEventId } = useAdmin();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Moment | null>(null);

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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl">Galeria</h1>
          <p className="mt-1 text-sm text-ink/50">Momentos aprovados. Destaque um para mostrar imediatamente na tela.</p>
        </div>
        {currentEventId && moments.length > 0 && (
          <a
            href={apiUrl(`/events/${currentEventId}/export`)}
            className="flex shrink-0 items-center gap-2 rounded-full border border-gold/30 bg-blush px-4 py-2 text-sm font-medium text-gold-dark hover:bg-gold/10"
          >
            <Download className="h-4 w-4" /> Descarregar todas (ZIP)
          </a>
        )}
      </div>

      {moments.length === 0 ? (
        <EmptyState icon={Star} title="Ainda sem momentos aprovados" />
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {moments.map((moment) => (
            <div key={moment.id} className="group relative overflow-hidden rounded-2xl border border-gold/20 bg-white">
              <button
                onClick={() => setSelected(moment)}
                className="relative block w-full cursor-zoom-in"
                aria-label="Pré-visualizar"
                title="Pré-visualizar"
              >
                <img src={moment.thumbnailUrl} alt="" className="aspect-square w-full object-cover" />
                {moment.mediaType === 'video' && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                    <Play className="h-6 w-6 fill-white text-white drop-shadow" />
                  </div>
                )}
              </button>
              <div className="flex items-center justify-between p-2">
                <button
                  onClick={() => highlight(moment.id)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium ${
                    highlightId === moment.id ? 'bg-gold text-white' : 'bg-blush text-gold-dark'
                  }`}
                >
                  <Star className="h-3.5 w-3.5" /> Destacar
                </button>
                <div className="flex items-center">
                  <a
                    href={apiUrl(`/events/${currentEventId}/moments/${moment.id}/download`)}
                    download
                    title="Descarregar"
                    aria-label="Descarregar"
                    className="rounded-full p-1.5 text-ink/40 hover:text-gold-dark"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button onClick={() => reject(moment.id)} className="rounded-full p-1.5 text-ink/40 hover:text-red-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelected(null)}
        >
          <div className="max-w-2xl" onClick={(e) => e.stopPropagation()}>
            {selected.mediaType === 'video' ? (
              <video
                src={selected.imageUrl}
                poster={selected.thumbnailUrl}
                controls
                autoPlay
                playsInline
                className="max-h-[75vh] w-full rounded-xl object-contain"
              />
            ) : (
              <img src={selected.imageUrl} alt="" className="max-h-[75vh] w-full rounded-xl object-contain" />
            )}
            <div className="mt-3 text-center text-white">
              {selected.message && <p className="italic">&ldquo;{selected.message}&rdquo;</p>}
              <p className="mt-1 text-sm text-white/70">
                {selected.guestName ?? 'Convidado'}
                {selected.tableNumber && ` · Mesa ${selected.tableNumber}`}
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
