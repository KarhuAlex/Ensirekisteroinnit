import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import type { ObjectStore } from './types.js';

export class FsStore implements ObjectStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private resolvePath(path: string): string {
    const full = resolve(join(this.root, normalize(path)));
    if (full !== this.root && !full.startsWith(this.root + sep)) {
      throw new Error(`Path escapes store root: ${path}`);
    }
    return full;
  }

  async put(path: string, body: string): Promise<void> {
    const full = this.resolvePath(path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, body, 'utf8');
  }

  async get(path: string): Promise<string | null> {
    try {
      return await readFile(this.resolvePath(path), 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }
}
