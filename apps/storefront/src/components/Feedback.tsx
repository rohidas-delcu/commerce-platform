import { type ReactNode } from 'react';
import { Package } from 'lucide-react';

export function Notice({ error, children }: { error?: unknown; children?: ReactNode }) {
  if (!error && !children) return null;
  return (
    <div className={`notice ${error ? 'error' : 'info'}`} role={error ? 'alert' : 'status'}>
      {error instanceof Error ? error.message : error ? String(error) : children}
    </div>
  );
}
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading">
      <span className="spinner" />
      {label}
    </div>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="empty">
      <Package size={36} strokeWidth={1.4} />
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </section>
  );
}
