import { useEffect, useState } from 'react';
import { Check, X, CheckCheck, XCircle, Play } from 'lucide-react';
import { useAdmin } from '@/context/AdminContext';
import { useEventRoom } from '@/hooks/useEventRoom';
import { api } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Moment } from '@/types';

export function ModerationPage() {
  const { currentEventId } = useAdmin();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  function refresh() {
    if (!currentEventId) return;
    api
      .get<Moment[]>(`/events/${currentEventId}/moments?status=pending`)
      .then(setMoments)
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [currentEventId]);
  useEventRoom(currentEventId ?? undefined, {
    'moment.created': (moment: Moment) => setMoments((prev) => [moment, ...prev]),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function approve(id: string) {
    setMoments((prev) => prev.filter((m) => m.id !== id));
    await api.patch(`/moments/${id}/approve`);
  }

  async function reject(id: string) {
    setMoments((prev) => prev.filter((m) => m.id !== id));
    await api.patch(`/moments/${id}/reject`);
  }

  async function bulk(action: 'approve' | 'reject') {
    if (selected.size === 0) return;
    setBusy(true);
    const ids = Array.from(selected);
    setMoments((prev) => prev.filter((m) => !selected.has(m.id)));
    setSelected(new Set());
    try {
      await api.post(`/moments/bulk/${action}`, { ids });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingSpinner label="A carregar momentos pendentes..." />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl">Moderação</h1>
          <p className="mt-1 text-sm text-ink/50">{moments.length} momento(s) à espera de aprovação.</p>
        </div>

        {selected.size > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => bulk('approve')}
              disabled={busy}
              className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <CheckCheck className="h-4 w-4" /> Aprovar {selected.size}
            </button>
            <button
              onClick={() => bulk('reject')}
              disabled={busy}
              className="flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" /> Rejeitar {selected.size}
            </button>
          </div>
        )}
      </div>

      {moments.length === 0 ? (
        <EmptyState icon={CheckCheck} title="Sem momentos pendentes" description="Novos envios vão aparecer aqui automaticamente." />
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {moments.map((moment) => (
            <div key={moment.id} className="overflow-hidden rounded-2xl border border-gold/20 bg-white">
              <div className="relative aspect-square">
                <img src={moment.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                {moment.mediaType === 'video' && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                    <Play className="h-6 w-6 fill-white text-white drop-shadow" />
                  </div>
                )}
                <input
                  type="checkbox"
                  checked={selected.has(moment.id)}
                  onChange={() => toggle(moment.id)}
                  className="absolute left-2 top-2 h-5 w-5 accent-gold"
                />
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium">{moment.guestName ?? 'Convidado anónimo'}</p>
                {moment.tableNumber && <p className="text-xs text-ink/50">Mesa {moment.tableNumber}</p>}
                {moment.message && <p className="mt-1 truncate text-xs italic text-ink/60">&ldquo;{moment.message}&rdquo;</p>}

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => approve(moment.id)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-full bg-emerald-600 py-2 text-xs font-medium text-white"
                  >
                    <Check className="h-3.5 w-3.5" /> Aprovar
                  </button>
                  <button
                    onClick={() => reject(moment.id)}
                    className="flex flex-1 items-center justify-center gap-1 rounded-full bg-red-600 py-2 text-xs font-medium text-white"
                  >
                    <X className="h-3.5 w-3.5" /> Rejeitar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
