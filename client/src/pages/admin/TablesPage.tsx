import { useEffect, useState } from 'react';
import { Plus, Trash2, QrCode, Download } from 'lucide-react';
import { useAdmin } from '@/context/AdminContext';
import { api, apiUrl } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { Table } from '@/types';

export function TablesPage() {
  const { currentEventId } = useAdmin();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  function refresh() {
    if (!currentEventId) return;
    api.get<Table[]>(`/events/${currentEventId}/tables`).then(setTables).finally(() => setLoading(false));
  }

  useEffect(refresh, [currentEventId]);

  async function createTable(e: React.FormEvent) {
    e.preventDefault();
    if (!currentEventId || !number.trim()) return;
    setCreating(true);
    try {
      const table = await api.post<Table>(`/events/${currentEventId}/tables`, { number: number.trim(), name: name.trim() || undefined });
      setTables((prev) => [...prev, table]);
      setNumber('');
      setName('');
    } finally {
      setCreating(false);
    }
  }

  async function removeTable(id: string) {
    setTables((prev) => prev.filter((t) => t.id !== id));
    await api.delete(`/tables/${id}`);
  }

  if (loading) return <LoadingSpinner label="A carregar mesas..." />;

  return (
    <div>
      <h1 className="font-serif text-2xl">QR Code</h1>
      <p className="mt-1 text-sm text-ink/50">Este é o único QR Code que precisa de imprimir e partilhar — funciona para qualquer convidado, em qualquer mesa.</p>

      {currentEventId && (
        <div className="mt-4 flex items-center gap-4 rounded-2xl border-2 border-gold bg-white p-5">
          <img src={apiUrl(`/events/${currentEventId}/qr?format=png`)} alt="QR geral" className="h-28 w-28" />
          <div>
            <p className="font-serif text-lg">QR geral do evento</p>
            <p className="text-sm text-ink/50">Aponte a câmara e é direcionado direto para a página de envio de fotos.</p>
            <div className="mt-2 flex gap-3 text-sm text-gold-dark">
              <a href={apiUrl(`/events/${currentEventId}/qr?format=png`)} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline underline-offset-4">
                <Download className="h-3.5 w-3.5" /> PNG
              </a>
              <a href={apiUrl(`/events/${currentEventId}/qr?format=svg`)} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline underline-offset-4">
                <Download className="h-3.5 w-3.5" /> SVG
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="mt-10 border-t border-gold/15 pt-6">
        <h2 className="font-serif text-xl">Mesas (opcional)</h2>
        <p className="mt-1 text-sm text-ink/50">
          Não é preciso imprimir um QR por mesa. Isto serve apenas para saber, nas Estatísticas, qual mesa foi mais ativa —
          se não precisar disso, pode ignorar esta secção.
        </p>

        <form onSubmit={createTable} className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-gold/20 bg-white p-4">
          <label className="flex flex-col gap-1 text-sm text-ink/60">
            Número
            <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="08" required className="rounded-lg border border-gold/30 px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink/60">
            Nome (opcional)
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Família Silva" className="rounded-lg border border-gold/30 px-3 py-2" />
          </label>
          <button type="submit" disabled={creating} className="flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            <Plus className="h-4 w-4" /> Adicionar mesa
          </button>
        </form>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((table) => (
          <div key={table.id} className="flex items-center gap-4 rounded-2xl border border-gold/20 bg-white p-4">
            <img src={apiUrl(`/events/${currentEventId}/qr?format=png&table=${table.number}`)} alt={`QR mesa ${table.number}`} className="h-20 w-20" />
            <div className="flex-1">
              <p className="flex items-center gap-1 font-medium">
                <QrCode className="h-4 w-4 text-gold-dark" /> Mesa {table.number}
              </p>
              {table.name && <p className="text-sm text-ink/50">{table.name}</p>}
              <div className="mt-1 flex gap-3 text-xs text-gold-dark">
                <a href={apiUrl(`/events/${currentEventId}/qr?format=png&table=${table.number}`)} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                  PNG
                </a>
                <a href={apiUrl(`/events/${currentEventId}/qr?format=svg&table=${table.number}`)} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                  SVG
                </a>
              </div>
            </div>
            <button onClick={() => removeTable(table.id)} className="text-ink/30 hover:text-red-600">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
