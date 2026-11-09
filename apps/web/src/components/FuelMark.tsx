import type { FuelGroupId } from '@regs/core';
import type { ReactElement } from 'react';

/**
 * One fixed shape per fuel group, modelled on fuel pump labels, so fuels are recognisable without
 * colour. Chart fills use the same colours, and yearly bars add matching hatch patterns.
 */
const SHAPES: Record<FuelGroupId, ReactElement> = {
  petrol: <circle cx="8" cy="8" r="6.25" />,
  diesel: <rect x="2" y="2" width="12" height="12" rx="1.5" />,
  bev: <path d="M2 2h7a5 5 0 0 1 5 5v7H7a5 5 0 0 1-5-5Z" />,
  phev: <path d="M8 1.5 14.5 8 8 14.5 1.5 8Z" />,
  other: <path d="M8 2 14.5 13.5h-13Z" />,
};

export function FuelMark({ group, size = 14 }: { group: FuelGroupId; size?: number }) {
  return (
    <svg
      className={`mark mark--${group}`}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[group]}
    </svg>
  );
}
