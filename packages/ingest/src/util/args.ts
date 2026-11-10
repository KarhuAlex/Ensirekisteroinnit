export function positiveInteger(name: string, text: string | undefined): number {
  const value = Number(text);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`--${name} must be a positive whole number`);
  }
  return value;
}
