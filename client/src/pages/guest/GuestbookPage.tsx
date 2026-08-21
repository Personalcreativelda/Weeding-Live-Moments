import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Heart, ArrowLeft } from 'lucide-react';
import { useEvent } from '@/hooks/useEvent';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { api } from '@/lib/api';

export function GuestbookPage() {
  const { slug } = useParams<{ slug: string }>();
  const { event, loading } = useEvent(slug);

  const [guestName, setGuestName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) return <LoadingSpinner label="A carregar..." />;
  if (!event) return null;

  async function submit() {
    if (!message.trim() || !event) return;
    setSending(true);
    setError(null);
    try {
      await api.post(`/events/${event.id}/messages`, {
        guestName: guestName.trim() || undefined,
        message: message.trim(),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar a mensagem.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10 safe-bottom">
      <Link to={`/e/${slug}`} className="flex items-center gap-1 self-start text-sm text-ink/50">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      {sent ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Heart className="h-10 w-10 fill-gold text-gold" />
          <h2 className="mt-4 font-serif text-2xl">Mensagem recebida!</h2>
          <p className="mt-2 max-w-xs text-ink/70">Obrigado por deixar as suas palavras para os noivos.</p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center">
          <h1 className="text-center font-serif text-2xl">Deixar uma mensagem</h1>
          <p className="mt-2 text-center text-sm text-ink/60">Sem fotografia obrigatória.</p>

          <div className="mt-8 flex flex-col gap-4">
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Seu nome (opcional)"
              maxLength={120}
              className="rounded-xl border border-gold/30 bg-white px-4 py-3 outline-none focus:border-gold"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Mensagem"
              maxLength={500}
              rows={5}
              className="resize-none rounded-xl border border-gold/30 bg-white px-4 py-3 outline-none focus:border-gold"
            />
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <button
            onClick={submit}
            disabled={sending || !message.trim()}
            className="mt-6 w-full rounded-full bg-gold px-8 py-4 font-medium text-white shadow-lg shadow-gold/30 disabled:opacity-50"
          >
            {sending ? 'A enviar...' : 'Enviar'}
          </button>
        </div>
      )}
    </div>
  );
}
