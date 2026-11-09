import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useI18n } from '../i18n';

interface ChartBindings {
  onHoverIndex: (index: number | null) => void;
  pointerIndex: number | null;
}

interface Props {
  ariaLabel: string;
  count: number;
  /** Earlier categories are hidden and cannot be stepped to. */
  lowest: number;
  hover: number | null;
  onHover: (index: number | null) => void;
  /** Spoken text for a category; only built while the user steps with the keyboard. */
  describe: (index: number) => string;
  children: (bindings: ChartBindings) => ReactNode;
}

/**
 * Makes a canvas chart usable without a mouse. The chart area takes focus, Arrow keys, Home,
 * End and Escape move the readout, and a live region announces each value.
 */
export function ChartFocus({
  ariaLabel,
  count,
  lowest,
  hover,
  onHover,
  describe,
  children,
}: Props) {
  const { t } = useI18n();
  const hintId = useId();
  // Announce only for keyboard stepping, not mouse movement.
  const [announce, setAnnounce] = useState(false);
  const index = Math.min(hover ?? count - 1, count - 1);

  const step = (to: number) => {
    setAnnounce(true);
    onHover(Math.max(lowest, Math.min(count - 1, to)));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = hover ?? count - 1;
    if (event.key === 'ArrowRight') step(current + 1);
    else if (event.key === 'ArrowLeft') step(current - 1);
    else if (event.key === 'Home') step(lowest);
    else if (event.key === 'End') step(count - 1);
    else if (event.key === 'Escape') onHover(null);
    else return;
    event.preventDefault();
  };

  return (
    <>
      <div
        className="chart-focus"
        role="group"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-describedby={hintId}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setAnnounce(false);
          onHover(null);
        }}
      >
        {children({
          onHoverIndex: (i) => {
            setAnnounce(false);
            onHover(i);
          },
          pointerIndex: hover,
        })}
      </div>
      <p id={hintId} className="sr-only">
        {t('chart.keyboardHint')}
      </p>
      <p className="sr-only" aria-live="polite">
        {announce ? describe(index) : ''}
      </p>
    </>
  );
}
