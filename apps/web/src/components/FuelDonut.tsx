import type { FuelGroupId } from '@regs/core';
import type { CSSProperties, ReactNode } from 'react';
import { donutSegments } from '../lib/donut';

const RADIUS = 42;

interface Props {
  /** Share of each fuel group in percent. */
  mix: Record<FuelGroupId, number>;
  ariaLabel: string;
  /** Shown in the middle of the ring. */
  children: ReactNode;
}

/** The fuel mix of one month as a ring. The ring itself is decoration; the legend carries the numbers. */
export function FuelDonut({ mix, ariaLabel, children }: Props) {
  return (
    <div className="donut" role="img" aria-label={ariaLabel}>
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <circle className="donut-track" cx="50" cy="50" r={RADIUS} pathLength={100} />
        {donutSegments(mix).map(({ group, start, dash, index }) => (
          <circle
            key={group}
            className={`donut-seg donut-seg--${group}`}
            cx="50"
            cy="50"
            r={RADIUS}
            pathLength={100}
            strokeDasharray={`${dash} 100`}
            strokeDashoffset={-start}
            style={{ '--i': index } as CSSProperties}
          />
        ))}
      </svg>
      <div className="donut-center">{children}</div>
    </div>
  );
}
