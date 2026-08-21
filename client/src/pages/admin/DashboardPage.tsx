import { useEffect, useState } from 'react';
import { Inbox, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useAdmin } from '@/context/AdminContext';
import { useEventRoom } from '@/hooks/useEventRoom';
import { api } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { Stats } from '@/types';

export function DashboardPage() {
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
  });

  if (!currentEventId) return <p className="text-ink/60">Nenhum evento associado a esta conta.</p>;
  if (loading || !stats) return <LoadingSpinner label="A carregar estatísticas..." />;

  return (
    <div>
      <h1 className="font-serif text-2xl">Dashboard</h1>
      <p className="mt-1 text-sm text-ink/50">Visão geral do casamento em tempo real.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Inbox} label="Momentos recebidos" value={stats.received} accent="text-ink" />
        <StatCard icon={Clock} label="Pendentes" value={stats.pending} accent="text-amber-600" />
        <StatCard icon={CheckCircle2} label="Aprovados" value={stats.approved} accent="text-emerald-600" />
        <StatCard icon={XCircle} label="Rejeitados" value={stats.rejected} accent="text-red-600" />
      </div>

      {stats.mostActiveTable && (
        <div className="mt-6 rounded-2xl border border-gold/20 bg-white p-5">
          <p className="text-sm text-ink/50">Mesa mais ativa</p>
          <p className="mt-1 font-serif text-xl">
            Mesa {stats.mostActiveTable.number}
            {stats.mostActiveTable.name ? ` · ${stats.mostActiveTable.name}` : ''}
          </p>
          <p className="text-sm text-ink/60">{stats.mostActiveTable.count} momentos</p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Inbox;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-gold/20 bg-white p-5">
      <Icon className={`h-5 w-5 ${accent}`} />
      <p className={`mt-3 font-serif text-3xl ${accent}`}>{value}</p>
      <p className="text-sm text-ink/50">{label}</p>
    </div>
  );
}
