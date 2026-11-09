export interface Logger {
  info(message: string, ...meta: unknown[]): void;
  warn(message: string, ...meta: unknown[]): void;
  error(message: string, ...meta: unknown[]): void;
}

export const consoleLogger: Logger = {
  info: (m, ...meta) => console.log(m, ...meta),
  warn: (m, ...meta) => console.warn(m, ...meta),
  error: (m, ...meta) => console.error(m, ...meta),
};

export const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
