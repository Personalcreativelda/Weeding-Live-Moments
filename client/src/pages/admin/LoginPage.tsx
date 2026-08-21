import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useAdmin } from '@/context/AdminContext';
import { ApiError } from '@/lib/api';

export function LoginPage() {
  const { login } = useAdmin();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/admin');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível iniciar sessão.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg shadow-gold/10">
        <div className="flex flex-col items-center text-center">
          <Heart className="h-8 w-8 fill-gold text-gold" />
          <h1 className="mt-4 font-serif text-2xl">Wedding Live Moments</h1>
          <p className="mt-1 text-sm text-ink/50">Acesso administrativo</p>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            className="rounded-xl border border-gold/30 px-4 py-3 outline-none focus:border-gold"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Palavra-passe"
            className="rounded-xl border border-gold/30 px-4 py-3 outline-none focus:border-gold"
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-full bg-gold px-8 py-3 font-medium text-white shadow-lg shadow-gold/30 disabled:opacity-50"
        >
          {submitting ? 'A entrar...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
