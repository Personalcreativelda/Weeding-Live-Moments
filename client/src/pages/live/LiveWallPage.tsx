import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useEvent } from '@/hooks/useEvent';
import { getSocket, joinEventRoom, leaveEventRoom } from '@/lib/socket';
import { api } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { LiveState, Moment, WallMode } from '@/types';

const SLIDE_MS = 8000;

export function LiveWallPage() {
  const { slug } = useParams<{ slug: string }>();
  const { event, loading: eventLoading } = useEvent(slug);

  const [moments, setMoments] = useState<Moment[]>([]);
  const [wallState, setWallState] = useState<LiveState | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadLiveState = useCallback(async (eventId: string) => {
    const data = await api.get<{ state: LiveState; moments: Moment[] }>(`/events/${eventId}/live-state`);
    setWallState(data.state);
    setMoments(data.moments);
  }, []);

  useEffect(() => {
    if (!event) return;
    loadLiveState(event.id).finally(() => setLoading(false));

    const socket = getSocket();
    joinEventRoom(event.id);

    const onCreated = () => {
      // A new pending moment doesn't change what's on screen; nothing to do here.
    };
    const onApproved = (moment: Moment) => setMoments((prev) => [moment, ...prev]);
    const onRejected = (moment: Moment) => setMoments((prev) => prev.filter((m) => m.id !== moment.id));
    const onPlay = (state: LiveState) => setWallState(state);
    const onPause = (state: LiveState) => setWallState(state);
    const onModeChanged = (state: LiveState) => setWallState(state);
    const onHighlight = () => loadLiveState(event.id);
    const onNext = () => setIndex((i) => i + 1);
    const onPrevious = () => setIndex((i) => Math.max(0, i - 1));
    const onReconnect = () => loadLiveState(event.id);

    socket.on('moment.created', onCreated);
    socket.on('moment.approved', onApproved);
    socket.on('moment.rejected', onRejected);
    socket.on('wall.play', onPlay);
    socket.on('wall.pause', onPause);
    socket.on('wall.mode.changed', onModeChanged);
    socket.on('wall.highlight', onHighlight);
    socket.on('wall.next', onNext);
    socket.on('wall.previous', onPrevious);
    socket.on('connect', onReconnect);

    return () => {
      socket.off('moment.created', onCreated);
      socket.off('moment.approved', onApproved);
      socket.off('moment.rejected', onRejected);
      socket.off('wall.play', onPlay);
      socket.off('wall.pause', onPause);
      socket.off('wall.mode.changed', onModeChanged);
      socket.off('wall.highlight', onHighlight);
      socket.off('wall.next', onNext);
      socket.off('wall.previous', onPrevious);
      socket.off('connect', onReconnect);
      leaveEventRoom(event.id);
    };
  }, [event, loadLiveState]);

  // Auto-advance the slideshow.
  useEffect(() => {
    if (!wallState || wallState.mode !== 'slideshow' || !wallState.playing || moments.length === 0) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % moments.length), SLIDE_MS);
    return () => clearInterval(timer);
  }, [wallState, moments.length]);

  // Preload the next couple of images so transitions feel instant.
  useEffect(() => {
    if (moments.length === 0) return;
    for (let offset = 1; offset <= 2; offset += 1) {
      const next = moments[(index + offset) % moments.length];
      if (next) {
        const img = new Image();
        img.src = next.imageUrl;
      }
    }
  }, [index, moments]);

  if (eventLoading || loading) return <BlackScreen><LoadingSpinner label="A carregar o mural..." /></BlackScreen>;
  if (!event) return <BlackScreen><p className="text-white/70">Evento não encontrado.</p></BlackScreen>;

  const mode: WallMode = wallState?.mode ?? 'slideshow';
  const highlighted = wallState?.highlightMomentId
    ? moments.find((m) => m.id === wallState.highlightMomentId) ?? null
    : null;

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-ink text-white">
      <Header event={event} count={moments.length} />

      <div className="flex flex-1 items-center justify-center px-8 pb-16">
        {mode === 'highlights' && highlighted ? (
          <FeaturedMoment moment={highlighted} />
        ) : mode === 'mosaic' || mode === 'latest' ? (
          <MosaicGrid moments={moments.slice(0, 9)} />
        ) : moments.length > 0 ? (
          <FeaturedMoment moment={moments[index % moments.length]} key={moments[index % moments.length].id} />
        ) : (
          <WaitingForMoments hashtag={event.hashtag} />
        )}
      </div>
    </div>
  );
}

function BlackScreen({ children }: { children: React.ReactNode }) {
  return <div className="flex h-screen w-screen items-center justify-center bg-ink">{children}</div>;
}

function Header({ event, count }: { event: { coupleName1: string; coupleName2: string; hashtag: string | null }; count: number }) {
  return (
    <div className="flex items-center justify-between px-10 py-6">
      <div className="flex items-center gap-3">
        <Heart className="h-6 w-6 fill-gold text-gold" />
        <div>
          <h1 className="font-serif text-2xl tracking-wide">
            {event.coupleName1} &amp; {event.coupleName2}
          </h1>
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">O Nosso Grande Dia</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm text-white/60">{count} momentos partilhados</p>
        {event.hashtag && <p className="text-gold">{event.hashtag}</p>}
      </div>
    </div>
  );
}

function FeaturedMoment({ moment }: { moment: Moment }) {
  return (
    <div className="animate-[fadeIn_1s_ease] flex max-h-full max-w-4xl flex-col items-center">
      <img
        src={moment.imageUrl}
        alt={moment.message ?? 'Momento'}
        className="max-h-[65vh] rounded-2xl object-contain shadow-2xl"
      />
      {(moment.message || moment.guestName) && (
        <div className="mt-6 text-center">
          {moment.message && <p className="text-2xl italic">&ldquo;{moment.message}&rdquo;</p>}
          <p className="mt-2 text-white/60">
            {moment.guestName && `— ${moment.guestName}`}
            {moment.tableNumber && ` · Mesa ${moment.tableNumber}`}
          </p>
        </div>
      )}
    </div>
  );
}

function MosaicGrid({ moments }: { moments: Moment[] }) {
  return (
    <div className="grid h-full w-full max-w-6xl grid-cols-3 gap-3">
      {moments.map((moment) => (
        <div key={moment.id} className="overflow-hidden rounded-xl bg-white/5">
          <img src={moment.imageUrl} alt={moment.message ?? 'Momento'} className="h-full w-full object-cover" />
        </div>
      ))}
      {Array.from({ length: Math.max(0, 9 - moments.length) }).map((_, i) => (
        <div key={`placeholder-${i}`} className="rounded-xl bg-white/5" />
      ))}
    </div>
  );
}

function WaitingForMoments({ hashtag }: { hashtag: string | null }) {
  return (
    <div className="text-center text-white/60">
      <Heart className="mx-auto h-10 w-10 text-gold" />
      <p className="mt-4 text-xl">À espera dos primeiros momentos...</p>
      {hashtag && <p className="mt-2 text-gold">{hashtag}</p>}
    </div>
  );
}
