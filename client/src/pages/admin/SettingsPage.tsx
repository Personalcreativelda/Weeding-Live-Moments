import { useEffect, useState } from 'react';
import { useAdmin } from '@/context/AdminContext';
import { api } from '@/lib/api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { WeddingEvent } from '@/types';

const THEMES = ['premium', 'romantico', 'minimalista', 'elegante', 'moderno'];

export function SettingsPage() {
  const { currentEventId } = useAdmin();
  const [event, setEvent] = useState<WeddingEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!currentEventId) return;
    api
      .get<WeddingEvent[]>('/events')
      .then((list) => list.find((e) => e.id === currentEventId))
      .then((found) => {
        if (found) setEvent(found as WeddingEvent);
      })
      .finally(() => setLoading(false));
  }, [currentEventId]);

  function update<K extends keyof WeddingEvent>(key: K, value: WeddingEvent[K]) {
    setEvent((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function save() {
    if (!event) return;
    setSaving(true);
    setSaved(false);
    try {
      await api.patch(`/events/${event.id}`, {
        name: event.name,
        coupleName1: event.coupleName1,
        coupleName2: event.coupleName2,
        hashtag: event.hashtag,
        welcomeMessage: event.welcomeMessage,
        primaryColor: event.primaryColor,
        secondaryColor: event.secondaryColor,
        theme: event.theme,
        isActive: event.isActive,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner label="A carregar configurações..." />;
  if (!event) return <p className="text-ink/60">Nenhum evento selecionado.</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="font-serif text-2xl">Configurações</h1>

      <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-gold/20 bg-white p-6">
        <Field label="Nome do evento">
          <input value={event.name} onChange={(e) => update('name', e.target.value)} className="input" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome do noivo/noiva 1">
            <input value={event.coupleName1} onChange={(e) => update('coupleName1', e.target.value)} className="input" />
          </Field>
          <Field label="Nome do noivo/noiva 2">
            <input value={event.coupleName2} onChange={(e) => update('coupleName2', e.target.value)} className="input" />
          </Field>
        </div>

        <Field label="Hashtag">
          <input value={event.hashtag ?? ''} onChange={(e) => update('hashtag', e.target.value)} className="input" />
        </Field>

        <Field label="Mensagem de boas-vindas">
          <textarea
            value={event.welcomeMessage ?? ''}
            onChange={(e) => update('welcomeMessage', e.target.value)}
            rows={3}
            className="input resize-none"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Cor principal">
            <input type="color" value={event.primaryColor} onChange={(e) => update('primaryColor', e.target.value)} className="h-10 w-full rounded-lg" />
          </Field>
          <Field label="Cor secundária">
            <input type="color" value={event.secondaryColor} onChange={(e) => update('secondaryColor', e.target.value)} className="h-10 w-full rounded-lg" />
          </Field>
        </div>

        <Field label="Estilo">
          <select value={event.theme} onChange={(e) => update('theme', e.target.value)} className="input capitalize">
            {THEMES.map((theme) => (
              <option key={theme} value={theme} className="capitalize">
                {theme}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input type="checkbox" checked={event.isActive} onChange={(e) => update('isActive', e.target.checked)} className="h-4 w-4 accent-gold" />
          Evento ativo (a receber momentos)
        </label>

        <div className="mt-2 flex items-center gap-3">
          <button onClick={save} disabled={saving} className="rounded-full bg-gold px-6 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {saving ? 'A guardar...' : 'Guardar alterações'}
          </button>
          {saved && <span className="text-sm text-emerald-600">Guardado!</span>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-ink/60">
      {label}
      {children}
    </label>
  );
}
