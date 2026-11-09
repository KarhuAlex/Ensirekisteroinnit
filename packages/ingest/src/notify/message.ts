import type { PublishNotice, PublishReason } from './types.js';

const REASONS: Record<PublishReason, string> = {
  'new-source': 'The source published new data.',
  forced: 'A refresh was forced.',
  'format-upgrade': 'The release format changed.',
};

export function describePublish(notice: PublishNotice): { subject: string; text: string } {
  return {
    subject: `Data updated: release ${notice.release}`,
    text: [
      REASONS[notice.reason],
      '',
      `Release: ${notice.release}`,
      `Source version: ${notice.sourceVersion}`,
      `Previous source version: ${notice.previousSourceVersion ?? 'none'}`,
      `Files: ${notice.files}`,
      `Generated: ${notice.generatedAt}`,
    ].join('\n'),
  };
}
