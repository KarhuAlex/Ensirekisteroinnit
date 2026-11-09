import { useEffect, type ReactNode } from 'react';

export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Sections are divided by rules, not boxed. */
export function Section({
  id,
  title,
  hideTitle,
  lede,
  tools,
  footnote,
  children,
}: {
  id: string;
  title: string;
  /** Hidden on screen, kept for assistive technology; the page headline already says it. */
  hideTitle?: boolean;
  lede?: ReactNode;
  tools?: ReactNode;
  footnote?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="block" aria-labelledby={id}>
      <header className={hideTitle ? 'block-head block-head--bare' : 'block-head'}>
        <div>
          <h2 id={id} className={hideTitle ? 'sr-only' : undefined}>
            {title}
          </h2>
          {lede && <p className="lede">{lede}</p>}
        </div>
        {tools && <div className="block-tools">{tools}</div>}
      </header>
      {children}
      {footnote && <p className="footnote">{footnote}</p>}
    </section>
  );
}

export interface Fact {
  label: string;
  value: string;
  note?: string;
  tone?: 'positive' | 'negative' | 'neutral';
}

export function Facts({ items }: { items: Fact[] }) {
  return (
    <dl className="facts">
      {items.map((f) => (
        <div className="fact" key={f.label}>
          <dt>{f.label}</dt>
          <dd>
            <span className="fact-value">{f.value}</span>
            {f.note && <span className={`fact-note is-${f.tone ?? 'neutral'}`}>{f.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function PageHeader({
  title,
  lede,
  children,
}: {
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      <h1>{title}</h1>
      {lede && <p className="lede">{lede}</p>}
      {children}
    </header>
  );
}

export function Skeleton({ height, label }: { height: number; label?: string }) {
  return (
    <div
      className="skeleton"
      style={{ height }}
      {...(label ? { role: 'status', 'aria-label': label } : { 'aria-hidden': true })}
    />
  );
}

export function StatusPanel({
  tone = 'neutral',
  title,
  hint,
  action,
}: {
  tone?: 'neutral' | 'error';
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`status status--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <p className="status-title">{title}</p>
      {hint && <p className="status-hint">{hint}</p>}
      {action}
    </div>
  );
}
