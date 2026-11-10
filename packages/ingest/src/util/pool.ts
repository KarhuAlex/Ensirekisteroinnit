/**
 * Maps items with at most `limit` calls in flight and keeps the results in input order. After the
 * first failure no new items start; the calls already running finish before the error is thrown,
 * so nothing keeps working in the background once the caller has been told it failed.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new Error(`Invalid concurrency: ${limit}`);
  const results = new Array<R>(items.length);
  let next = 0;
  let failure: { error: unknown } | undefined;

  const worker = async (): Promise<void> => {
    while (!failure && next < items.length) {
      const index = next++;
      try {
        results[index] = await fn(items[index] as T, index);
      } catch (error) {
        failure ??= { error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failure) throw failure.error;
  return results;
}
