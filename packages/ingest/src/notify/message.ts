import type { FailureNotice, PublishNotice, PublishReason } from './types.js';

const REASONS: Record<PublishReason, string> = {
  'new-source': 'The source published new data.',
  forced: 'A refresh was forced.',
  'format-upgrade': 'The release format changed.',
};

export function describePublish(notice: PublishNotice): { subject: string; text: string } {
  return {
    subject: `Data updated (${notice.pipeline}): release ${notice.release}`,
    text: [
      REASONS[notice.reason],
      '',
      `Dataset: ${notice.pipeline}`,
      `Release: ${notice.release}`,
      `Source version: ${notice.sourceVersion}`,
      `Previous source version: ${notice.previousSourceVersion ?? 'none'}`,
      `Files: ${notice.files}`,
      `Generated: ${notice.generatedAt}`,
    ].join('\n'),
  };
}

export function describeFailure(notice: FailureNotice): { subject: string; text: string } {
  return {
    subject: `Ingest failed (${notice.pipeline})`,
    text: [
      `The ${notice.pipeline} run failed and the published data was not changed.`,
      '',
      `Time: ${notice.occurredAt}`,
      `Error: ${notice.message}`,
    ].join('\n'),
  };
}
