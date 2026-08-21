import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import imageCompression from 'browser-image-compression';
import { Camera, Heart, Image as ImageIcon, ArrowLeft, X, Plus } from 'lucide-react';
import { useEvent } from '@/hooks/useEvent';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { uploadWithProgress } from '@/lib/uploadWithProgress';
import { apiUrl } from '@/lib/api';
import type { Moment } from '@/types';

type Step = 'landing' | 'choose' | 'form' | 'uploading' | 'success' | 'error';
type PhotoStatus = 'pending' | 'uploading' | 'done' | 'error';

interface PhotoItem {
  id: string;
  file: File;
  previewUrl: string;
  status: PhotoStatus;
  progress: number;
}

let nextPhotoId = 0;

/**
 * crypto.randomUUID() only exists in secure contexts (https or localhost), and guests
 * often open this over plain http on a LAN IP while testing — so a plain counter is used
 * instead of relying on it.
 */
function localPhotoId(): string {
  nextPhotoId += 1;
  return `photo-${Date.now()}-${nextPhotoId}`;
}

export function GuestEventPage() {
  const { slug, tableNumber } = useParams<{ slug: string; tableNumber?: string }>();
  const { event, loading, error: eventError } = useEvent(slug);

  const [step, setStep] = useState<Step>('landing');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [guestName, setGuestName] = useState('');
  const [message, setMessage] = useState('');
  const [compressing, setCompressing] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      for (const p of photos) URL.revokeObjectURL(p.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setCompressing(true);
    setPickError(null);
    try {
      const newItems = await Promise.all(
        Array.from(fileList).map(async (file): Promise<PhotoItem> => {
          try {
            const compressed = await imageCompression(file, {
              maxSizeMB: 1.5,
              maxWidthOrHeight: 2400,
              useWebWorker: true,
              fileType: 'image/jpeg',
            });
            return { id: localPhotoId(), file: compressed, previewUrl: URL.createObjectURL(compressed), status: 'pending', progress: 0 };
          } catch {
            return { id: localPhotoId(), file, previewUrl: URL.createObjectURL(file), status: 'pending', progress: 0 };
          }
        })
      );
      setPhotos((prev) => [...prev, ...newItems]);
      setStep('form');
    } catch {
      setPickError('Não foi possível preparar as fotografias. Tente novamente.');
    } finally {
      setCompressing(false);
    }
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function submitAll() {
    if (!event || photos.length === 0) return;
    setStep('uploading');

    const toSend = photos.filter((p) => p.status !== 'done');
    let anyError = false;

    for (const photo of toSend) {
      setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: 'uploading', progress: 0 } : p)));

      const formData = new FormData();
      formData.append('photo', photo.file);
      if (guestName.trim()) formData.append('guestName', guestName.trim());
      if (message.trim()) formData.append('message', message.trim());
      if (tableNumber) formData.append('tableNumber', tableNumber);

      try {
        await uploadWithProgress<Moment>(apiUrl(`/events/${event.id}/moments`), formData, (percent) => {
          setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, progress: percent } : p)));
        });
        setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: 'done', progress: 100 } : p)));
      } catch {
        anyError = true;
        setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, status: 'error', progress: 0 } : p)));
      }
    }

    setStep(anyError ? 'error' : 'success');
  }

  function shareAnother() {
    for (const p of photos) URL.revokeObjectURL(p.previewUrl);
    setPhotos([]);
    setGuestName('');
    setMessage('');
    setStep('choose');
  }

  const doneCount = photos.filter((p) => p.status === 'done').length;
  const errorCount = photos.filter((p) => p.status === 'error').length;
  const overallProgress =
    photos.length === 0 ? 0 : Math.round(photos.reduce((sum, p) => sum + (p.status === 'done' ? 100 : p.progress), 0) / photos.length);

  if (loading) return <LoadingSpinner label="A carregar o evento..." />;

  if (eventError || !event) {
    return (
      <CenteredCard>
        <Heart className="mx-auto h-8 w-8 text-gold" />
        <h1 className="mt-4 text-xl font-semibold">{eventError ?? 'Evento não encontrado.'}</h1>
        <p className="mt-2 text-sm text-ink/60">Verifique o QR Code ou contacte a organização do evento.</p>
      </CenteredCard>
    );
  }

  if (!event.isActive) {
    return (
      <CenteredCard>
        <Heart className="mx-auto h-8 w-8 text-gold" />
        <h1 className="mt-4 text-xl font-semibold">Este evento não está a receber momentos.</h1>
      </CenteredCard>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10 safe-bottom">
      {step === 'landing' && (
        <Landing event={event} slug={slug} tableNumber={tableNumber} onStart={() => setStep('choose')} />
      )}

      {step === 'choose' && (
        <ChooseSource
          compressing={compressing}
          error={pickError}
          onBack={() => setStep('landing')}
          onCamera={() => cameraInputRef.current?.click()}
          onGallery={() => galleryInputRef.current?.click()}
        />
      )}

      {step === 'form' && photos.length > 0 && (
        <MomentForm
          photos={photos}
          guestName={guestName}
          message={message}
          tableNumber={tableNumber}
          compressing={compressing}
          error={pickError}
          onRemove={removePhoto}
          onAddCamera={() => cameraInputRef.current?.click()}
          onAddGallery={() => galleryInputRef.current?.click()}
          onGuestNameChange={setGuestName}
          onMessageChange={setMessage}
          onBack={() => setStep('choose')}
          onSubmit={submitAll}
        />
      )}

      {step === 'uploading' && <UploadingScreen progress={overallProgress} doneCount={doneCount} total={photos.length} />}

      {step === 'success' && <SuccessScreen count={photos.length} onShareAnother={shareAnother} />}

      {step === 'error' && (
        <ErrorScreen
          doneCount={doneCount}
          errorCount={errorCount}
          total={photos.length}
          onRetry={submitAll}
          onBack={shareAnother}
        />
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}

function Landing({
  event,
  slug,
  tableNumber,
  onStart,
}: {
  event: { coupleName1: string; coupleName2: string; welcomeMessage: string | null; hashtag: string | null };
  slug: string | undefined;
  tableNumber: string | undefined;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <Heart className="h-9 w-9 fill-gold text-gold" />
      <h1 className="mt-6 font-serif text-3xl tracking-wide text-ink">
        {event.coupleName1}
        <span className="mx-2 text-gold">&amp;</span>
        {event.coupleName2}
      </h1>
      <p className="mt-2 text-sm uppercase tracking-[0.2em] text-gold-dark">O Nosso Grande Dia</p>

      <p className="mt-8 max-w-xs text-ink/70">
        {event.welcomeMessage ?? 'Ajude-nos a guardar este momento.'}
      </p>

      <button
        onClick={onStart}
        className="mt-10 w-full rounded-full bg-gold px-8 py-4 font-medium text-white shadow-lg shadow-gold/30 transition active:scale-[0.98]"
      >
        Partilhar um momento
      </button>

      <div className="mt-6 flex flex-col items-center gap-2 text-sm text-ink/50">
        {tableNumber && <span>Mesa {tableNumber}</span>}
        {event.hashtag && <span className="text-gold-dark">{event.hashtag}</span>}
      </div>

      <div className="mt-8 flex gap-4 text-sm text-gold-dark underline underline-offset-4">
        <Link to={`/e/${slug}/guestbook`}>Deixar uma mensagem</Link>
      </div>
    </div>
  );
}

function ChooseSource({
  onCamera,
  onGallery,
  onBack,
  compressing,
  error,
}: {
  onCamera: () => void;
  onGallery: () => void;
  onBack: () => void;
  compressing: boolean;
  error: string | null;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center">
      <BackButton onClick={onBack} />
      <h2 className="mt-6 text-center font-serif text-2xl">Como quer partilhar?</h2>
      {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}

      {compressing ? (
        <LoadingSpinner label="A preparar as fotografias..." />
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          <button
            onClick={onCamera}
            className="flex items-center justify-center gap-3 rounded-2xl border border-gold/30 bg-white px-6 py-5 font-medium text-ink shadow-sm active:scale-[0.98]"
          >
            <Camera className="h-5 w-5 text-gold-dark" />
            Tirar fotografia
          </button>
          <button
            onClick={onGallery}
            className="flex items-center justify-center gap-3 rounded-2xl border border-gold/30 bg-white px-6 py-5 font-medium text-ink shadow-sm active:scale-[0.98]"
          >
            <ImageIcon className="h-5 w-5 text-gold-dark" />
            Escolher da galeria
          </button>
          <p className="text-center text-sm text-ink/50">Pode escolher várias fotos da galeria de uma só vez.</p>
        </div>
      )}
    </div>
  );
}

function MomentForm({
  photos,
  guestName,
  message,
  tableNumber,
  compressing,
  error,
  onRemove,
  onAddCamera,
  onAddGallery,
  onGuestNameChange,
  onMessageChange,
  onBack,
  onSubmit,
}: {
  photos: PhotoItem[];
  guestName: string;
  message: string;
  tableNumber: string | undefined;
  compressing: boolean;
  error: string | null;
  onRemove: (id: string) => void;
  onAddCamera: () => void;
  onAddGallery: () => void;
  onGuestNameChange: (v: string) => void;
  onMessageChange: (v: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <BackButton onClick={onBack} />

      <p className="mt-4 text-sm text-ink/60">
        {photos.length === 1 ? '1 fotografia selecionada' : `${photos.length} fotografias selecionadas`}
      </p>

      <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative shrink-0">
            <img src={photo.previewUrl} alt="" className="h-24 w-24 rounded-xl object-cover shadow-sm" />
            <button
              onClick={() => onRemove(photo.id)}
              aria-label="Remover fotografia"
              className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white shadow"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

        <button
          onClick={onAddGallery}
          aria-label="Adicionar mais fotografias"
          className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gold/40 text-gold-dark"
        >
          <Plus className="h-6 w-6" />
          <span className="text-xs">Adicionar</span>
        </button>
      </div>

      {compressing && <p className="mt-1 text-sm text-ink/50">A preparar novas fotografias...</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      <div className="mt-2 flex gap-4 text-sm text-gold-dark underline underline-offset-4">
        <button onClick={onAddCamera}>Tirar mais uma</button>
        <button onClick={onAddGallery}>Escolher mais da galeria</button>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-ink/70">
          Seu nome (opcional)
          <input
            value={guestName}
            onChange={(e) => onGuestNameChange(e.target.value)}
            maxLength={120}
            placeholder="O seu nome"
            className="rounded-xl border border-gold/30 bg-white px-4 py-3 text-ink outline-none focus:border-gold"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-ink/70">
          Mensagem para os noivos (opcional)
          <textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Felicidades ao casal ❤️"
            className="resize-none rounded-xl border border-gold/30 bg-white px-4 py-3 text-ink outline-none focus:border-gold"
          />
        </label>

        {tableNumber && <p className="text-sm text-ink/50">Mesa {tableNumber} (automático)</p>}
      </div>

      <button
        onClick={onSubmit}
        className="mt-8 w-full rounded-full bg-gold px-8 py-4 font-medium text-white shadow-lg shadow-gold/30 active:scale-[0.98]"
      >
        {photos.length === 1 ? 'Publicar momento' : `Publicar ${photos.length} momentos`}
      </button>
    </div>
  );
}

function UploadingScreen({ progress, doneCount, total }: { progress: number; doneCount: number; total: number }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="text-ink/70">
        {total > 1 ? `A enviar as suas fotografias... (${doneCount}/${total})` : 'A enviar o seu momento...'}
      </p>
      <div className="mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-gold/15">
        <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 text-sm text-gold-dark">{progress}%</p>
    </div>
  );
}

function SuccessScreen({ count, onShareAnother }: { count: number; onShareAnother: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <Heart className="h-10 w-10 fill-gold text-gold" />
      <h2 className="mt-4 font-serif text-2xl">{count === 1 ? 'Momento recebido!' : `${count} momentos recebidos!`}</h2>
      <p className="mt-2 max-w-xs text-ink/70">Obrigado por fazer parte da nossa história.</p>
      <p className="mt-1 max-w-xs text-sm text-ink/50">
        {count === 1 ? 'A sua fotografia será adicionada' : 'As suas fotografias serão adicionadas'} ao nosso mural.
      </p>

      <button
        onClick={onShareAnother}
        className="mt-8 w-full rounded-full border border-gold px-8 py-4 font-medium text-gold-dark active:scale-[0.98]"
      >
        Partilhar mais momentos
      </button>
    </div>
  );
}

function ErrorScreen({
  doneCount,
  errorCount,
  total,
  onRetry,
  onBack,
}: {
  doneCount: number;
  errorCount: number;
  total: number;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <p className="text-ink/70">
        {doneCount > 0
          ? `${doneCount} de ${total} momentos foram publicados. ${errorCount} não foi possível enviar.`
          : 'Não conseguimos concluir o envio.'}
      </p>
      <button
        onClick={onRetry}
        className="mt-8 w-full rounded-full bg-gold px-8 py-4 font-medium text-white shadow-lg shadow-gold/30 active:scale-[0.98]"
      >
        Tentar novamente
      </button>
      <button onClick={onBack} className="mt-3 text-sm text-ink/50 underline underline-offset-4">
        Escolher outras fotografias
      </button>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 self-start text-sm text-ink/50">
      <ArrowLeft className="h-4 w-4" /> Voltar
    </button>
  );
}
