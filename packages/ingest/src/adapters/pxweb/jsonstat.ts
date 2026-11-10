/** Minimal JSON-stat 2.0 reader, just enough for PxWeb `json-stat2` responses. */

export interface JsonStatDoc {
  id: string[];
  size: number[];
  value: (number | null)[];
  updated?: string;
  note?: string[];
  dimension: Record<
    string,
    { category: { index: Record<string, number> | string[]; label?: Record<string, string> } }
  >;
}

export interface Cell {
  coords: Record<string, string>;
  value: number | null;
}

export function categoryCodes(doc: JsonStatDoc, dim: string): string[] {
  const entry = doc.dimension[dim];
  if (!entry) throw new Error(`JSON-stat response has no dimension "${dim}"`);
  const index = entry.category.index;
  if (Array.isArray(index)) return index;
  return Object.entries(index)
    .sort((a, b) => a[1] - b[1])
    .map(([code]) => code);
}

/** Iterates every cell in row-major order: the last dimension varies fastest. */
export function* iterateCells(doc: JsonStatDoc): Generator<Cell> {
  const codes = doc.id.map((d) => categoryCodes(doc, d));
  const total = doc.size.reduce((a, b) => a * b, 1);
  if (doc.value.length !== total) {
    throw new Error(
      `JSON-stat value length ${doc.value.length} does not match size product ${total}`,
    );
  }
  const counters = new Array<number>(doc.id.length).fill(0);
  for (let flat = 0; flat < total; flat++) {
    const coords: Record<string, string> = {};
    for (let d = 0; d < doc.id.length; d++) {
      const dimId = doc.id[d] as string;
      coords[dimId] = (codes[d] as string[])[counters[d] as number] as string;
    }
    yield { coords, value: doc.value[flat] ?? null };
    for (let d = doc.id.length - 1; d >= 0; d--) {
      counters[d] = (counters[d] as number) + 1;
      if ((counters[d] as number) < (doc.size[d] as number)) break;
      counters[d] = 0;
    }
  }
}
