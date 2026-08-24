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

  // Preload the next couple of images so transitions feel instant (videos stream on demand).
  useEffect(() => {
    if (moments.length === 0) return;
    for (let offset = 1; offset <= 2; offset += 1) {
      const next = moments[(index + offset) % moments.length];
      if (next && next.mediaType !== 'video') {
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
  const showSlideProgress = mode === 'slideshow' && (wallState?.playing ?? true) && moments.length > 1;

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#100c09] text-white">
      <AmbientGlow />

      <Header event={event} count={moments.length} />

      <div className="relative z-10 flex flex-1 items-center justify-center px-8 pb-16">
        {mode === 'highlights' && highlighted ? (
          <FeaturedMoment moment={highlighted} animate={false} />
        ) : mode === 'mosaic' || mode === 'latest' ? (
          <MosaicGrid moments={moments.slice(0, 9)} />
        ) : moments.length > 0 ? (
          <FeaturedMoment moment={moments[index % moments.length]} key={moments[index % moments.length].id} animate />
        ) : (
          <WaitingForMoments hashtag={event.hashtag} />
        )}
      </div>

      {showSlideProgress && (
        <div className="absolute inset-x-0 bottom-0 z-10 h-1 bg-white/10">
          <div
            key={index}
            className="h-full bg-gold animate-progress-fill"
            style={{ animationDuration: `${SLIDE_MS}ms` }}
          />
        </div>
      )}
    </div>
  );
}

function BlackScreen({ children }: { children: React.ReactNode }) {
  return <div className="flex h-screen w-screen items-center justify-center bg-[#100c09]">{children}</div>;
}

/** A slow-drifting warm glow behind everything so the screen feels alive even between slides. */
function AmbientGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[70vmax] w-[70vmax] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl animate-ambient-drift"
      style={{
        background: 'radial-gradient(circle, rgba(176,137,104,0.35) 0%, rgba(176,137,104,0.08) 45%, transparent 70%)',
      }}
    />
  );
}

function Header({ event, count }: { event: { coupleName1: string; coupleName2: string; hashtag: string | null }; count: number }) {
  return (
    <div className="relative z-10 flex items-center justify-between px-10 py-6">
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

function FeaturedMoment({ moment, animate }: { moment: Moment; animate: boolean }) {
  return (
    <div className={`flex max-h-full max-w-4xl flex-col items-center ${animate ? 'animate-[fadeIn_1.1s_ease]' : ''}`}>
      <div className="relative max-h-[65vh] overflow-hidden rounded-2xl shadow-2xl shadow-black/60">
        {moment.mediaType === 'video' ? (
          <video
            src={moment.imageUrl}
            poster={moment.thumbnailUrl}
            autoPlay
            muted
            loop
            playsInline
            className={`max-h-[65vh] object-contain ${animate ? 'animate-ken-burns' : ''}`}
            style={animate ? { animationDuration: `${SLIDE_MS}ms` } : undefined}
          />
        ) : (
          <img
            src={moment.imageUrl}
            alt={moment.message ?? 'Momento'}
            className={`max-h-[65vh] object-contain ${animate ? 'animate-ken-burns' : ''}`}
            style={animate ? { animationDuration: `${SLIDE_MS}ms` } : undefined}
          />
        )}
        {/* Vignette for depth, so the photo/video reads as a "scene" rather than a flat pasted image. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ boxShadow: 'inset 0 0 8vmin 1vmin rgba(0,0,0,0.45)' }}
        />
      </div>

      {(moment.message || moment.guestName) && (
        <div className="mt-7 max-w-2xl text-center animate-caption-rise" style={{ animationDelay: '0.5s' }}>
          {moment.message && <p className="font-serif text-2xl italic leading-snug">&ldquo;{moment.message}&rdquo;</p>}
          <p className="mt-2 text-sm uppercase tracking-[0.2em] text-gold/80">
            {moment.guestName && moment.guestName}
            {moment.guestName && moment.tableNumber && ' · '}
            {moment.tableNumber && `Mesa ${moment.tableNumber}`}
          </p>
        </div>
      )}
    </div>
  );
}

function MosaicGrid({ moments }: { moments: Moment[] }) {
  return (
    <div className="grid h-full w-full max-w-6xl grid-cols-3 gap-3">
      {moments.map((moment, i) => (
        <div
          key={moment.id}
          className="animate-[fadeIn_0.6s_ease_both] overflow-hidden rounded-xl bg-white/5 shadow-lg shadow-black/40"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <img src={moment.thumbnailUrl} alt={moment.message ?? 'Momento'} className="h-full w-full object-cover" />
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
