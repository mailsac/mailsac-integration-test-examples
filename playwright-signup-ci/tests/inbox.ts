// Test inboxes for CI. Each test gets a fresh address, waits for the email to arrive,
// and reads it. Two backends share one interface:
//   - Mailsac (default): real inboxes you read over the Mailsac REST API. Works with
//     Mailsac Email Capture and with real delivery through your email provider.
//   - Mailpit: a local SMTP catcher for fast per-pull-request runs (INBOX=mailpit).
import { randomBytes } from 'node:crypto';

export type ReceivedEmail = {
  id: string;
  subject: string;
  text: string;
  links: string[];
};

export interface TestInbox {
  /** A new, unique address for one test. */
  newAddress(prefix?: string): string;
  /** Poll until an email for `address` arrives (optionally matching the subject). */
  waitForEmail(address: string, opts?: { subject?: string | RegExp; timeoutMs?: number }): Promise<ReceivedEmail>;
  /** Remove the message after the test, so private inboxes stay tidy. */
  cleanup(address: string, id: string): Promise<void>;
}

const unique = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`.toLowerCase();

const matches = (subject: string, want?: string | RegExp) =>
  !want || (typeof want === 'string' ? subject.includes(want) : want.test(subject));

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const extractLinks = (text: string) => [...text.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) => m[0]);

/** Mailsac: https://docs.mailsac.com — authenticate with the Mailsac-Key header. */
export class MailsacInbox implements TestInbox {
  private readonly base = process.env.MAILSAC_API_URL || 'https://mailsac.com/api';

  constructor(
    private readonly apiKey = process.env.MAILSAC_API_KEY,
    // Use your own private domain (MAILSAC_DOMAIN=test.example.com) to keep test mail private;
    // @mailsac.com inboxes are public, so only send made-up data to them.
    private readonly domain = process.env.MAILSAC_DOMAIN || 'mailsac.com',
  ) {
    if (!this.apiKey) throw new Error('Set MAILSAC_API_KEY (free at https://mailsac.com/register)');
  }

  newAddress(prefix = 'signup') {
    return `${unique(prefix)}@${this.domain}`;
  }

  private async api(path: string, init: RequestInit = {}) {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: { 'Mailsac-Key': this.apiKey!, ...(init.headers || {}) },
    });
    if (!res.ok) throw new Error(`Mailsac API ${init.method || 'GET'} ${path}: ${res.status} ${await res.text()}`);
    return res;
  }

  async waitForEmail(address: string, { subject, timeoutMs = 60_000 }: { subject?: string | RegExp; timeoutMs?: number } = {}) {
    const inbox = encodeURIComponent(address);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const messages: Array<{ _id: string; subject: string; links?: string[] }> =
        await (await this.api(`/addresses/${inbox}/messages`)).json();
      const message = messages.find((m) => matches(m.subject || '', subject));
      if (message) {
        const text = await (await this.api(`/text/${inbox}/${encodeURIComponent(message._id)}`)).text();
        return { id: message._id, subject: message.subject, text, links: message.links?.length ? message.links : extractLinks(text) };
      }
      await sleep(2_000);
    }
    throw new Error(`No email for ${address} within ${timeoutMs / 1000}s`);
  }

  async cleanup(address: string, id: string) {
    await this.api(`/addresses/${encodeURIComponent(address)}/messages/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}

/** Mailpit: https://mailpit.axllent.org — local SMTP on 1025, API on 8025. */
export class MailpitInbox implements TestInbox {
  constructor(private readonly base = process.env.MAILPIT_URL || 'http://localhost:8025') {}

  newAddress(prefix = 'signup') {
    return `${unique(prefix)}@example.test`;
  }

  async waitForEmail(address: string, { subject, timeoutMs = 30_000 }: { subject?: string | RegExp; timeoutMs?: number } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await fetch(`${this.base}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}`);
      const { messages = [] } = (await res.json()) as { messages?: Array<{ ID: string; Subject: string }> };
      const message = messages.find((m) => matches(m.Subject || '', subject));
      if (message) {
        const full = (await (await fetch(`${this.base}/api/v1/message/${message.ID}`)).json()) as { Text: string; Subject: string };
        return { id: message.ID, subject: full.Subject, text: full.Text, links: extractLinks(full.Text) };
      }
      await sleep(500);
    }
    throw new Error(`No email for ${address} within ${timeoutMs / 1000}s`);
  }

  async cleanup(_address: string, id: string) {
    await fetch(`${this.base}/api/v1/messages`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ IDs: [id] }),
    });
  }
}

export const testInbox = (): TestInbox => (process.env.INBOX === 'mailpit' ? new MailpitInbox() : new MailsacInbox());
