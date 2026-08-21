import { useEffect, useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, Star, Grid3x3, Images, ExternalLink } from 'lucide-react';
import { useAdmin } from '@/context/AdminContext';
import { api } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { LiveState, Moment, WallMode } from '@/types';

type Action = 'play' | 'pause' | 'next' | 'previous' | 'mode' | 'highlight' | 'clear-highlight';

export function ScreensPage() {
  const { currentEventId, events } = useAdmin();
  const [state, setState] = useState<LiveState | null>(null);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);

  const eventSlug = events.find((e) => e.id === currentEventId)?.slug;

  function refresh() {
    if (!currentEventId) return;
    api
      .get<{ state: LiveState; moments: Moment[] }>(`/events/${currentEventId}/live-state`)
      .then((data) => {
        setState(data.state);
        setMoments(data.moments);
      })
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [currentEventId]);

  async function control(action: Action, extra?: { mode?: WallMode; momentId?: string }) {
    if (!currentEventId) return;
    const next = await api.post<LiveState>(`/events/${currentEventId}/wall/control`, { action, ...extra });
    setState(next);
  }

  if (loading || !state) return <LoadingSpinner label="A carregar controlo da tela..." />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl">Telas</h1>
        {eventSlug && (
          <a
            href={`/e/${eventSlug}/live`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full border border-gold/30 px-4 py-2 text-sm text-gold-dark"
          >
            <ExternalLink className="h-4 w-4" /> Abrir Live Wall
          </a>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-gold/20 bg-white p-6">
        <p className="text-sm text-ink/50">Modo atual</p>
        <p className="font-serif text-xl capitalize">{state.mode}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          <ControlButton icon={state.playing ? Pause : Play} label={state.playing ? 'Pausar' : 'Iniciar'} onClick={() => control(state.playing ? 'pause' : 'play')} />
          <ControlButton icon={SkipBack} label="Anterior" onClick={() => control('previous')} />
          <ControlButton icon={SkipForward} label="Próxima" onClick={() => control('next')} />
        </div>

        <p className="mt-6 text-sm text-ink/50">Modo de exibição</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <ControlButton icon={Images} label="Slideshow" active={state.mode === 'slideshow'} onClick={() => control('mode', { mode: 'slideshow' })} />
          <ControlButton icon={Grid3x3} label="Mosaico" active={state.mode === 'mosaic'} onClick={() => control('mode', { mode: 'mosaic' })} />
          <ControlButton icon={Star} label="Destaques" active={state.mode === 'highlights'} onClick={() => control('mode', { mode: 'highlights' })} />
          <ControlButton icon={Images} label="Últimos momentos" active={state.mode === 'latest'} onClick={() => control('mode', { mode: 'latest' })} />
        </div>
      </div>

      <div className="mt-6">
        <h2 className="font-serif text-lg">Destacar na tela</h2>
        <p className="text-sm text-ink/50">Útil para entrada dos noivos, brinde, bolo ou dança.</p>

        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
          {moments.map((moment) => (
            <button
              key={moment.id}
              onClick={() => control('highlight', { momentId: moment.id })}
              className={`overflow-hidden rounded-xl border-2 ${
                state.highlightMomentId === moment.id ? 'border-gold' : 'border-transparent'
              }`}
            >
              <img src={moment.thumbnailUrl} alt="" className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>

        {state.highlightMomentId && (
          <button onClick={() => control('clear-highlight')} className="mt-4 text-sm text-ink/50 underline underline-offset-4">
            Remover destaque
          </button>
        )}
      </div>
    </div>
  );
}

function ControlButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: typeof Play;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? 'bg-gold text-white' : 'bg-blush text-ink/70 hover:bg-gold/20'
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
