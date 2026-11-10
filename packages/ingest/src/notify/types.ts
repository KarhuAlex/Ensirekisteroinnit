export type PublishReason = 'new-source' | 'forced' | 'format-upgrade';

export interface PublishNotice {
  pipeline: string;
  reason: PublishReason;
  release: string;
  sourceVersion: string;
  previousSourceVersion: string | null;
  files: number;
  generatedAt: string;
}

export interface FailureNotice {
  pipeline: string;
  message: string;
  occurredAt: string;
}

export interface Notifier {
  published(notice: PublishNotice): Promise<void>;
  failed(notice: FailureNotice): Promise<void>;
}
