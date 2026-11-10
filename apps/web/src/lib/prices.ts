/** A series on another list of months: each of `to` gets its value, or `null` if `from` lacks it. */
export function alignToMonths(
  to: readonly string[],
  from: readonly string[],
  values: readonly (number | null)[],
): (number | null)[] {
  const index = new Map(from.map((month, i) => [month, i]));
  return to.map((month) => {
    const i = index.get(month);
    return i === undefined ? null : (values[i] ?? null);
  });
}

/** The last month that has a price for either fuel, or `null` if there is none. */
export function lastPricedIndex(
  petrol: readonly (number | null)[],
  diesel: readonly (number | null)[],
): number | null {
  const last = Math.max(
    petrol.findLastIndex((v) => v !== null),
    diesel.findLastIndex((v) => v !== null),
  );
  return last >= 0 ? last : null;
}
