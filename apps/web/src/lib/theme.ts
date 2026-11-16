import type { FuelGroupId } from '@regs/core';
import type { Scheme } from './colorScheme';
import { useColorScheme } from './colorSchemeStore';

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

let probe: HTMLSpanElement | null = null;

/** A hidden element outside the React root, used to read tokens as computed colours. */
function tokenProbe(): HTMLSpanElement {
  if (!probe?.isConnected) {
    probe = document.createElement('span');
    probe.hidden = true;
    document.body.append(probe);
  }
  return probe;
}

/**
 * Turns the tokens into concrete colours. A token is a light-dark() pair (or the build's lowered
 * version of one) and only resolves where it is used, so each token is set on the probe and its
 * computed colour read back.
 */
function read(): ThemeColors {
  const element = tokenProbe();
  const style = getComputedStyle(element);
  const resolve = (token: string, fallback: string) => {
    element.style.color = `var(${token}, ${fallback})`;
    return style.color || fallback;
  };
  return {
    ink: resolve('--ink', FALLBACK.ink),
    muted: resolve('--ink-2', FALLBACK.muted),
    faint: resolve('--ink-3', FALLBACK.faint),
    rule: resolve('--rule', FALLBACK.rule),
    ground: resolve('--ground', FALLBACK.ground),
    fuel: {
      bev: resolve('--fuel-bev', FALLBACK.fuel.bev),
      phev: resolve('--fuel-phev', FALLBACK.fuel.phev),
      petrol: resolve('--fuel-petrol', FALLBACK.fuel.petrol),
      diesel: resolve('--fuel-diesel', FALLBACK.fuel.diesel),
      other: resolve('--fuel-other', FALLBACK.fuel.other),
    },
    hatch: resolve('--hatch', FALLBACK.hatch),
    series: FALLBACK.series.map((fallback, i) => resolve(`--series-${i + 1}`, fallback)),
  };
}

let resolved: { scheme: Scheme; colors: ThemeColors } | null = null;

/** The colours of a scheme, read once and shared by every chart. */
function colorsFor(scheme: Scheme): ThemeColors {
  if (resolved?.scheme !== scheme) resolved = { scheme, colors: read() };
  return resolved.colors;
}

/** CSS tokens as concrete values, because canvas charts cannot read CSS variables. */
export function useThemeColors(): ThemeColors {
  return colorsFor(useColorScheme().scheme);
}
