import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-ink/60">
      <Icon className="h-10 w-10 text-gold/60" />
      <p className="font-medium text-ink/80">{title}</p>
      {description && <p className="max-w-sm text-sm">{description}</p>}
    </div>
  );
}
