import { gzipSync } from 'node:zlib';

export interface EncodedBody {
  data: Buffer;
  contentEncoding?: 'gzip';
}

export function encodeBody(body: string, compress: boolean): EncodedBody {
  const raw = Buffer.from(body, 'utf8');
  return compress ? { data: gzipSync(raw, { level: 9 }), contentEncoding: 'gzip' } : { data: raw };
}
