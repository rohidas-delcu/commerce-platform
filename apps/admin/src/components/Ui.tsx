import { type ReactNode } from 'react';

export function ErrorNotice({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="notice error" role="alert">
      {error instanceof Error ? error.message : 'Something went wrong. Please try again.'}
    </div>
  );
}
export function InfoNotice({ children }: { children: ReactNode }) {
  return <div className="notice info">{children}</div>;
}
export function Loading({ text = 'Loading workspace…' }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      {text}
    </div>
  );
}
export function PageHead({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-desc">{subtitle}</p>
      </div>
      <div className="page-actions">{children}</div>
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  children,
  actions,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="panel">
      {title && (
        <div className="panel-header">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </section>
  );
}
export function Status({ value }: { value: string | undefined | null }) {
  const status = (value || 'UNKNOWN').toUpperCase();
  const cls = /PAID|ACTIVE|PUBLISHED|SUCCEEDED|DELIVERED|COMPLETED|CONFIRMED/.test(status)
    ? 'success'
    : /DRAFT|PENDING|DUE|UNKNOWN|REVIEW/.test(status)
      ? 'warning'
      : /CANCELLED|FAILED|ARCHIVED|SUSPENDED/.test(status)
        ? 'danger'
        : 'neutral';
  return <span className={`badge ${cls}`}>{status.replaceAll('_', ' ')}</span>;
}
