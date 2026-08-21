import { useEffect, useState } from 'react';
import { BookHeart } from 'lucide-react';
import { useAdmin } from '@/context/AdminContext';
import { useEventRoom } from '@/hooks/useEventRoom';
import { api } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import type { GuestMessage } from '@/types';

export function GuestbookAdminPage() {
  const { currentEventId } = useAdmin();
  const [messages, setMessages] = useState<GuestMessage[]>([]);
  const [loading, setLoading] = useState(true);

  function refresh() {
    if (!currentEventId) return;
    api
      .get<GuestMessage[]>(`/events/${currentEventId}/messages`)
      .then(setMessages)
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [currentEventId]);
  useEventRoom(currentEventId ?? undefined, {
    'message.created': (message: GuestMessage) => setMessages((prev) => [message, ...prev]),
  });

  if (loading) return <LoadingSpinner label="A carregar mensagens..." />;

  return (
    <div>
      <h1 className="font-serif text-2xl">Livro de Visitas</h1>
      <p className="mt-1 text-sm text-ink/50">{messages.length} mensagem(ns) recebida(s).</p>

      {messages.length === 0 ? (
        <EmptyState icon={BookHeart} title="Ainda sem mensagens" />
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {messages.map((msg) => (
            <div key={msg.id} className="rounded-2xl border border-gold/20 bg-white p-4">
              <p className="italic text-ink/80">&ldquo;{msg.message}&rdquo;</p>
              <p className="mt-2 text-sm text-ink/50">{msg.guestName ?? 'Convidado anónimo'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
