import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gold-dark">
      <Loader2 className="h-8 w-8 animate-spin" />
      {label && <p className="text-sm text-ink/60">{label}</p>}
    </div>
  );
}
