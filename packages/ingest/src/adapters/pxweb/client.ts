import type { JsonStatDoc } from './jsonstat.js';

export interface PxVariable {
  code: string;
  text: string;
  values: string[];
  valueTexts: string[];
  time?: boolean;
}

export interface PxTableMeta {
  title: string;
  variables: PxVariable[];
}

export interface PxListItem {
  id: string;
  type: string;
  text: string;
  updated?: string;
}

export interface PxQuery {
  query: { code: string; selection: { filter: 'item' | 'all'; values: string[] } }[];
  response: { format: 'json-stat2' };
}

export interface PxWebClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  /** Base delay for exponential backoff, in ms. */
  retryDelayMs?: number;
  /** A request that runs longer is aborted and retried. */
  timeoutMs?: number;
  userAgent?: string;
}

const DEFAULT_TIMEOUT_MS = 180_000;

/** Thin client for the PxWeb v1 API (https://www.scb.se/en/services/statistical-programs-for-px-files/px-web/). */
export class PxWebClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly timeoutMs: number;
  private readonly userAgent: string;

  constructor(opts: PxWebClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.maxRetries = opts.maxRetries ?? 5;
    this.retryDelayMs = opts.retryDelayMs ?? 2000;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.userAgent = opts.userAgent ?? 'ensirekisteroinnit-ingest/0.1';
  }

  listFolder(path: string): Promise<PxListItem[]> {
    return this.request<PxListItem[]>('GET', path);
  }

  getTableMeta(path: string): Promise<PxTableMeta> {
    return this.request<PxTableMeta>('GET', path);
  }

  async query(path: string, query: PxQuery): Promise<{ doc: JsonStatDoc; raw: string }> {
    const raw = await this.requestText('POST', path, JSON.stringify(query));
    return { doc: JSON.parse(raw) as JsonStatDoc, raw };
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: string): Promise<T> {
    return JSON.parse(await this.requestText(method, path, body)) as T;
  }

  private async requestText(method: 'GET' | 'POST', path: string, body?: string): Promise<string> {
    const url = `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) await sleep(this.retryDelayMs * 2 ** (attempt - 1));
      try {
        return await this.send(method, url, body);
      } catch (err) {
        if (err instanceof PxWebHttpError && !err.retryable) throw err;
        lastError = err;
      }
    }
    throw lastError;
  }

  private async send(method: 'GET' | 'POST', url: string, body?: string): Promise<string> {
    const res = await this.fetchImpl(url, {
      method,
      headers: {
        Accept: 'application/json',
        'User-Agent': this.userAgent,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body } : {}),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (res.ok) return res.text();
    throw new PxWebHttpError(method, url, res.status, await res.text());
  }
}

/** A non-2xx PxWeb response. Rate limiting and server errors are worth retrying; client errors are not. */
export class PxWebHttpError extends Error {
  constructor(
    readonly method: string,
    readonly url: string,
    readonly status: number,
    detail: string,
  ) {
    super(`PxWeb ${method} ${url} failed with HTTP ${status}${detail ? `: ${detail}` : ''}`);
    this.name = 'PxWebHttpError';
  }

  get retryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
