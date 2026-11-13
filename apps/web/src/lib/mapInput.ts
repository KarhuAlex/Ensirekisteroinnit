import { ZOOM_STEP, clamp } from './mapView';

const ARROWS: ReadonlyMap<string, readonly [number, number]> = new Map([
  ['ArrowLeft', [-1, 0]],
  ['ArrowRight', [1, 0]],
  ['ArrowUp', [0, 1]],
  ['ArrowDown', [0, -1]],
]);

/** The steps east and north that an arrow key pans the map; `null` for any other key. */
export const panDirection = (key: string): readonly [number, number] | null =>
  ARROWS.get(key) ?? null;

/** Only a wheel turn with Ctrl or Cmd held zooms the map, so that the page can still scroll. */
export const wheelZooms = (event: { ctrlKey: boolean; metaKey: boolean }): boolean =>
  event.ctrlKey || event.metaKey;

/** A notch of a mouse wheel is about this many pixels; a trackpad pinch sends many small turns. */
const WHEEL_NOTCH_PIXELS = 100;
const PIXELS_PER_LINE = 16;
const PIXELS_PER_PAGE = 400;

/**
 * The zoom factor of one wheel event, in proportion to how far it turned (away from you zooms in).
 * A whole notch is one zoom step, and no single event goes further than that.
 */
export function wheelFactor(event: { deltaY: number; deltaMode: number }): number {
  const unit = [1, PIXELS_PER_LINE, PIXELS_PER_PAGE][event.deltaMode] ?? 1;
  const factor = Math.exp((-event.deltaY * unit * Math.log(ZOOM_STEP)) / WHEEL_NOTCH_PIXELS);
  return clamp(factor, 1 / ZOOM_STEP, ZOOM_STEP);
}
