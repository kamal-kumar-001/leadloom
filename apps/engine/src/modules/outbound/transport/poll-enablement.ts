/**
 * Live IMAP polling enablement. Default OFF: nothing in this repo may poll a
 * live mailbox unless LEADLOOM_IMAP_POLL_ENABLED=true is set deliberately by
 * the operator. Any future scheduler or endpoint that invokes ImapReplyPoller
 * against a real mailbox MUST gate on this flag first; fixture tests never
 * need it (they never reach a live server).
 */
export function isImapPollEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.LEADLOOM_IMAP_POLL_ENABLED === 'true';
}
