import { DefaultAzureCredential } from '@azure/identity';
import { EmailClient } from '@azure/communication-email';
import { describePublish } from './message.js';
import type { Notifier, PublishNotice } from './types.js';

export interface AcsEmailOptions {
  endpoint: string;
  from: string;
  to: string[];
}

export class AcsEmailNotifier implements Notifier {
  private readonly client: EmailClient;

  constructor(private readonly options: AcsEmailOptions) {
    this.client = new EmailClient(options.endpoint, new DefaultAzureCredential());
  }

  async published(notice: PublishNotice): Promise<void> {
    const { subject, text } = describePublish(notice);
    await this.client.beginSend({
      senderAddress: this.options.from,
      recipients: { to: this.options.to.map((address) => ({ address })) },
      content: { subject, plainText: text },
    });
  }
}
