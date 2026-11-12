/**
 * Message composer port: resolves a reservation's opaque messageRef into the
 * actual outbound message. Queue payloads carry identifiers only, never
 * recipient lists or plaintext bodies (see queue.ts), so the transport asks
 * the composer for content at send time, inside the authenticated worker.
 *
 * scope carries the reservation's workspace: implementations MUST apply it as
 * the tenant boundary on every read and fail closed on a mismatch, never
 * resolving content across workspaces.
 */
export interface ComposedMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Campaign/mailbox context used for List-Unsubscribe and threading. */
  campaignId: string;
  mailboxId: string;
}

export interface ComposerScope {
  workspaceId: string;
}

export interface MessageComposer {
  resolve(messageRef: string, scope: ComposerScope): Promise<ComposedMessage>;
}

/** Test double: resolves refs from an in-memory map. */
export class InMemoryMessageComposer implements MessageComposer {
  constructor(private readonly messages: Record<string, ComposedMessage>) {}

  async resolve(messageRef: string, scope: ComposerScope): Promise<ComposedMessage> {
    if (!scope.workspaceId) throw new Error('Composer scope requires a workspace');
    const message = this.messages[messageRef];
    if (!message) throw new Error(`Unknown message reference: ${messageRef.slice(0, 12)}`);
    return message;
  }
}
