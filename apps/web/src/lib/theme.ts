import type { FuelGroupId } from '@regs/core';
import { useEffect, useState } from 'react';

export interface ThemeColors {
  ink: string;
  muted: string;
  faint: string;
  rule: string;
  ground: string;
  /** Fill colour per fuel group, read from the CSS tokens so both themes stay in sync. */
  fuel: Record<FuelGroupId, string>;
  hatch: string;
  /** One colour for each line of a comparison, in order. */
  series: string[];
}

const FALLBACK: ThemeColors = {
  ink: '#0b1f33',
  muted: '#3d5166',
  faint: '#5b6e82',
  rule: '#d5dee7',
  ground: '#ffffff',
  fuel: { bev: '#00a86b', phev: '#2f7fd1', petrol: '#e8a400', diesel: '#3f4f61', other: '#7f8fa0' },
  hatch: 'rgba(255,255,255,0.55)',
  series: ['#c2410c', '#7c3aed', '#0e7490', '#be185d'],
};

function read(): ThemeColors {
  const style = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    ink: get('--ink', FALLBACK.ink),
    muted: get('--ink-2', FALLBACK.muted),
    faint: get('--ink-3', FALLBACK.faint),
    rule: get('--rule', FALLBACK.rule),
    ground: get('--ground', FALLBACK.ground),
    fuel: {
      bev: get('--fuel-bev', FALLBACK.fuel.bev),
      phev: get('--fuel-phev', FALLBACK.fuel.phev),
      petrol: get('--fuel-petrol', FALLBACK.fuel.petrol),
      diesel: get('--fuel-diesel', FALLBACK.fuel.diesel),
      other: get('--fuel-other', FALLBACK.fuel.other),
    },
    hatch: get('--hatch', FALLBACK.hatch),
    series: FALLBACK.series.map((fallback, i) => get(`--series-${i + 1}`, fallback)),
  };
}

/** CSS tokens as concrete values, because canvas charts cannot read CSS variables. */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(read);
  useEffect(() => {
    const update = () => setColors(read());
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => {
      media.removeEventListener('change', update);
      observer.disconnect();
    };
  }, []);
  return colors;
}

export type ThemeChoice = 'light' | 'dark';

export function currentTheme(): ThemeChoice {
  const explicit = document.documentElement.dataset['theme'];
  if (explicit === 'light' || explicit === 'dark') return explicit;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(theme: ThemeChoice): void {
  document.documentElement.dataset['theme'] = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* storage unavailable (private mode, blocked cookies); the choice just will not persist */
  }
}
