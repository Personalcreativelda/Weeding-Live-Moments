import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Heart, X, Play, Download } from 'lucide-react';
import { useEvent } from '@/hooks/useEvent';
import { useEventRoom } from '@/hooks/useEventRoom';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { api, apiUrl } from '@/lib/api';
import type { Moment } from '@/types';

export function PublicGalleryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { event, loading: eventLoading } = useEvent(slug);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Moment | null>(null);

  useEffect(() => {
    if (!event) return;
    api
      .get<Moment[]>(`/events/${event.id}/gallery`)
      .then(setMoments)
      .finally(() => setLoading(false));
  }, [event]);

  useEventRoom(event?.id, {
    'moment.approved': (moment: Moment) => setMoments((prev) => [moment, ...prev]),
  });

  if (eventLoading || loading) return <LoadingSpinner label="A carregar a galeria..." />;
  if (!event) return null;

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-10">
      <div className="text-center">
        <Heart className="mx-auto h-8 w-8 fill-gold text-gold" />
        <h1 className="mt-3 font-serif text-2xl">Galeria do Nosso Grande Dia</h1>
        <p className="text-sm text-ink/50">
          {event.coupleName1} &amp; {event.coupleName2}
        </p>
      </div>

      {moments.length === 0 ? (
        <EmptyState icon={Heart} title="Ainda não há momentos aprovados" description="Volte em breve para ver as fotografias partilhadas." />
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {moments.map((moment) => (
            <div
              key={moment.id}
              className="group relative aspect-square overflow-hidden rounded-xl bg-blush shadow-sm"
            >
              <button
                onClick={() => setSelected(moment)}
                className="h-full w-full cursor-zoom-in"
                aria-label="Ver momento"
              >
                <img src={moment.thumbnailUrl} alt={moment.message ?? 'Momento'} className="h-full w-full object-cover" loading="lazy" />
                {moment.mediaType === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                    <Play className="h-8 w-8 fill-white text-white drop-shadow" />
                  </div>
                )}
              </button>
              <a
                href={apiUrl(`/events/${event.id}/moments/${moment.id}/download`)}
                download
                title="Descarregar"
                aria-label="Descarregar"
                className="absolute bottom-2 right-2 rounded-full bg-black/50 p-2 text-white transition-opacity hover:bg-black/70 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Download className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelected(null)}
        >
          <div className="max-w-lg" onClick={(e) => e.stopPropagation()}>
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
              <img src={selected.imageUrl} alt={selected.message ?? 'Momento'} className="max-h-[75vh] w-full rounded-xl object-contain" />
            )}
            <div className="mt-3 text-center text-white">
              {selected.message && <p className="italic">&ldquo;{selected.message}&rdquo;</p>}
              <p className="mt-1 text-sm text-white/70">
                {selected.guestName ?? 'Convidado'}
                {selected.tableNumber && ` · Mesa ${selected.tableNumber}`}
              </p>
            </div>
            <a
              href={apiUrl(`/events/${event.id}/moments/${selected.id}/download`)}
              download
              title="Descarregar"
              aria-label="Descarregar"
              className="absolute left-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            >
              <Download className="h-5 w-5" />
            </a>
            <button
              onClick={() => setSelected(null)}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
