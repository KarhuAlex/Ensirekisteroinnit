import { DefaultAzureCredential } from '@azure/identity';
import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';
import { encodeBody } from './encode.js';
import type { ObjectStore, PutOptions } from './types.js';

export class BlobStore implements ObjectStore {
  constructor(private readonly container: ContainerClient) {}

  /**
   * Connects with managed identity or developer credentials, or with a connection string when one
   * is given (for example for Azurite).
   */
  static connect(opts: {
    accountUrl?: string;
    connectionString?: string;
    container: string;
  }): BlobStore {
    const service = opts.connectionString
      ? BlobServiceClient.fromConnectionString(opts.connectionString)
      : new BlobServiceClient(
          requireValue(opts.accountUrl, 'accountUrl'),
          new DefaultAzureCredential(),
        );
    return new BlobStore(service.getContainerClient(opts.container));
  }

  async put(path: string, body: string, options: PutOptions = {}): Promise<void> {
    const blob = this.container.getBlockBlobClient(path);
    const { data, contentEncoding } = encodeBody(body, options.compress ?? false);
    await blob.upload(data, data.length, {
      blobHTTPHeaders: {
        blobContentType: options.contentType ?? 'application/json; charset=utf-8',
        ...(options.cacheControl ? { blobCacheControl: options.cacheControl } : {}),
        ...(contentEncoding ? { blobContentEncoding: contentEncoding } : {}),
      },
    });
  }

  async get(path: string): Promise<string | null> {
    const blob = this.container.getBlobClient(path);
    if (!(await blob.exists())) return null;
    const buffer = await blob.downloadToBuffer();
    return buffer.toString('utf8');
  }
}

function requireValue(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing required option: ${name}`);
  return value;
}
