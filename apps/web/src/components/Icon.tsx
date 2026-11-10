import type { SVGProps } from 'react';

const PATHS = {
  search: 'M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm5 11.5 4.5 4.5',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5.5v2.2m0 14.6v2.2M2.5 12h2.2m14.6 0h2.2M5.3 5.3l1.6 1.6m10.2 10.2 1.6 1.6m0-13.4-1.6 1.6M6.9 17.1l-1.6 1.6',
  moon: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z',
  overview: 'M4.5 20v-8.5M10 20V5M15.5 20v-6M21 20H3',
  models: 'M4 6.5h16M4 12h16M4 17.5h10',
  table: 'M3.5 5.5h17v13h-17ZM3.5 10.5h17M9.5 5.5v13',
  info: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm0 7.5v5.5m0-9v.1',
  download: 'M12 4v11m-5-4 5 5 5-5M5 20h14',
  close: 'M6 6l12 12M18 6 6 18',
  arrowRight: 'M5 12h14m-6-6 6 6-6 6',
  arrowLeft: 'M19 12H5m6-6-6 6 6 6',
  arrowUp: 'M12 19V5m-6 6 6-6 6 6',
  arrowDown: 'M12 5v14m-6-6 6 6 6-6',
  compare: 'M8 4v16m0 0-3-3m3 3 3-3M16 20V4m0 0-3 3m3-3 3 3',
  review: 'M4 5.5h16v14H4ZM4 10h16M8.5 3.5v4M15.5 3.5v4',
  sortNone: 'm8 9 4-4 4 4M8 15l4 4 4-4',
  sortAsc: 'm7 14 5-5 5 5',
  sortDesc: 'm7 10 5 5 5-5',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

/** One 24px grid, 1.75px stroke, round caps. Decorative unless a label is given. */
export function Icon({ name, size = 20, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
