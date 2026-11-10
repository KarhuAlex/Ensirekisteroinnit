/** The error message followed by the messages of its causes, so a wrapped failure stays readable. */
export function describeError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  while (current !== undefined && parts.length < 4) {
    parts.push(current instanceof Error ? current.message : String(current));
    current = current instanceof Error ? current.cause : undefined;
  }
  return parts.join(' <- ');
}
