/** The colour of one compared line, as a small square beside its name. */
export function SeriesMark({ slot }: { slot: number }) {
  return <span className="series-mark" style={{ background: `var(--series-${slot + 1})` }} />;
}
