import { useEffect, useRef, useState } from 'react';
import { X, RotateCcw } from 'lucide-react';

const HOLD_THRESHOLD_MS = 280;
const RING_RADIUS = 34;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface CameraCaptureProps {
  maxVideoSeconds: number;
  onCapture: (file: File, mediaType: 'image' | 'video') => void;
  onClose: () => void;
  /** Camera access failed (permission denied, no camera, insecure context, …) — let the caller fall back to the OS picker. */
  onUnavailable: () => void;
}

const VIDEO_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return VIDEO_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * WhatsApp/Instagram/TikTok-style in-page camera: tap the shutter for a photo,
 * hold it to record video (auto-stops at maxVideoSeconds). Falls back to the
 * device's native camera app (via onUnavailable) when getUserMedia can't be
 * used — e.g. no HTTPS, permission denied, or no camera at all.
 */
export function CameraCapture({ maxVideoSeconds, onCapture, onClose, onUnavailable }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef(false);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      setReady(false);
      stopStream();

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        onUnavailable();
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setReady(true);
      } catch {
        // Mic permission is a common single point of failure — retry video-only before giving up.
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
          setReady(true);
        } catch {
          if (!cancelled) onUnavailable();
        }
      }
    }

    start();
    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function cleanupTimers() {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    holdTimerRef.current = null;
    autoStopTimerRef.current = null;
    tickRef.current = null;
  }

  useEffect(() => cleanupTimers, []);

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file, 'image');
      },
      'image/jpeg',
      0.92
    );
  }

  function startRecording() {
    const stream = streamRef.current;
    if (!stream) return;

    const mimeType = pickSupportedMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const type = mimeType?.split(';')[0] ?? 'video/webm';
      const blob = new Blob(chunksRef.current, { type });
      const extension = type.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([blob], `video-${Date.now()}.${extension}`, { type });
      onCapture(file, 'video');
    };

    recorder.start();
    recorderRef.current = recorder;
    recordingRef.current = true;
    setRecording(true);
    setElapsedMs(0);

    const startedAt = Date.now();
    tickRef.current = setInterval(() => setElapsedMs(Date.now() - startedAt), 50);
    autoStopTimerRef.current = setTimeout(() => stopRecording(), maxVideoSeconds * 1000);
  }

  function stopRecording() {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    setRecording(false);
    cleanupTimers();
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  function handlePointerDown() {
    if (!ready || recording) return;
    holdTimerRef.current = setTimeout(() => startRecording(), HOLD_THRESHOLD_MS);
  }

  function handlePointerUp() {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      if (!recordingRef.current) {
        capturePhoto();
        return;
      }
    }
    if (recordingRef.current) stopRecording();
  }

  const progress = Math.min(1, elapsedMs / (maxVideoSeconds * 1000));
  const ringOffset = RING_CIRCUMFERENCE * (1 - progress);
  const seconds = Math.floor(elapsedMs / 1000);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70">A abrir a câmara...</div>
        )}

        <button
          onClick={onClose}
          aria-label="Fechar câmara"
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <button
          onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
          aria-label="Trocar câmara"
          disabled={recording}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white disabled:opacity-40"
        >
          <RotateCcw className="h-5 w-5" />
        </button>

        {recording && (
          <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            {seconds}s / {maxVideoSeconds}s
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 bg-black py-8 safe-bottom">
        <button
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          disabled={!ready}
          aria-label="Toque para foto, segure para gravar vídeo"
          className="relative flex h-20 w-20 items-center justify-center rounded-full disabled:opacity-40"
        >
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="4" />
            {recording && (
              <circle
                cx="40"
                cy="40"
                r={RING_RADIUS}
                fill="none"
                stroke="#ef4444"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={ringOffset}
              />
            )}
          </svg>
          <span className={`h-14 w-14 rounded-full border-4 border-white bg-white/10 transition-transform ${recording ? 'scale-75 rounded-2xl bg-red-500' : ''}`} />
        </button>
        <p className="text-xs text-white/50">Toque para foto · segure para vídeo</p>
      </div>
    </div>
  );
}
