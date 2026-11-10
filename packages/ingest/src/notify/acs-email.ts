import { DefaultAzureCredential } from '@azure/identity';
import { EmailClient } from '@azure/communication-email';
import { describeFailure, describePublish } from './message.js';
import type { FailureNotice, Notifier, PublishNotice } from './types.js';

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

  published(notice: PublishNotice): Promise<void> {
    return this.send(describePublish(notice));
  }

  failed(notice: FailureNotice): Promise<void> {
    return this.send(describeFailure(notice));
  }

  private async send({ subject, text }: { subject: string; text: string }): Promise<void> {
    await this.client.beginSend({
      senderAddress: this.options.from,
      recipients: { to: this.options.to.map((address) => ({ address })) },
      content: { subject, plainText: text },
    });
  }
}
