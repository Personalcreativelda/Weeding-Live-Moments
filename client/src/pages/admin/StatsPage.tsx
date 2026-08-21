import { useEffect, useState } from 'react';
import { Camera, MessageSquareHeart, CheckCircle2, XCircle, Users, Download } from 'lucide-react';
import { useAdmin } from '@/context/AdminContext';
import { useEventRoom } from '@/hooks/useEventRoom';
import { api, apiUrl } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { Stats } from '@/types';

export function StatsPage() {
  const { currentEventId } = useAdmin();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  function refresh() {
    if (!currentEventId) return;
    api.get<Stats>(`/events/${currentEventId}/stats`).then(setStats).finally(() => setLoading(false));
  }

  useEffect(refresh, [currentEventId]);
  useEventRoom(currentEventId ?? undefined, {
    'moment.created': refresh,
    'moment.approved': refresh,
    'moment.rejected': refresh,
    'message.created': refresh,
  });

  if (loading || !stats) return <LoadingSpinner label="A carregar estatísticas..." />;

  const rows = [
    { icon: Camera, label: 'Total de fotografias', value: stats.received },
    { icon: CheckCircle2, label: 'Momentos aprovados', value: stats.approved },
    { icon: XCircle, label: 'Momentos rejeitados', value: stats.rejected },
    { icon: MessageSquareHeart, label: 'Mensagens do livro de visitas', value: stats.messages },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-2xl">Estatísticas</h1>
        {currentEventId && (
          <a
            href={apiUrl(`/events/${currentEventId}/export`)}
            className="flex items-center gap-2 rounded-full border border-gold/30 px-4 py-2 text-sm text-gold-dark"
          >
            <Download className="h-4 w-4" /> Exportar evento
          </a>
        )}
      </div>

      <div className="mt-6 divide-y divide-gold/15 rounded-2xl border border-gold/20 bg-white">
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4 text-gold-dark" />
              <span className="text-sm text-ink/70">{label}</span>
            </div>
            <span className="font-serif text-xl">{value}</span>
          </div>
        ))}

        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <Users className="h-4 w-4 text-gold-dark" />
            <span className="text-sm text-ink/70">Mesa mais ativa</span>
          </div>
          <span className="font-serif text-xl">
            {stats.mostActiveTable ? `Mesa ${stats.mostActiveTable.number} (${stats.mostActiveTable.count})` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
