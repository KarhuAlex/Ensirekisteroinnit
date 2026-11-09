export type PublishReason = 'new-source' | 'forced' | 'format-upgrade';

export interface PublishNotice {
  reason: PublishReason;
  release: string;
  sourceVersion: string;
  previousSourceVersion: string | null;
  files: number;
  generatedAt: string;
}

export interface Notifier {
  published(notice: PublishNotice): Promise<void>;
}
