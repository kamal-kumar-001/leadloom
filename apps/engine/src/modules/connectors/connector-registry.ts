// Honest connector status. Static facts plus the live feature flags; nothing here claims a route works unless the code exists.
export type ConnectorState = 'login_verify_only' | 'not_built' | 'partner_limited' | 'unverified';
export interface ConnectorStatus {
  id: string;
  name: string;
  state: ConnectorState;
  sendingEnabled: false;
  enabled: boolean;
  note: string;
  reference?: string;
}
export function connectorStatuses(env: Record<string, string | undefined> = process.env): ConnectorStatus[] {
  return [
    {
      id: 'smtp_imap', name: 'Mailbox (IMAP + SMTP app password)', state: 'login_verify_only', sendingEnabled: false,
      enabled: env.LEADLOOM_MAILBOX_CONNECT_ENABLED === 'true',
      note: 'Verifies the login and stores the credential encrypted. No email is sent; outbound sending is not enabled.',
    },
    {
      id: 'gmail_oauth', name: 'Gmail sign-in (OAuth)', state: 'not_built', sendingEnabled: false, enabled: false,
      note: "Not built. Needs a Google Cloud OAuth app; Google's verification rules apply.",
      reference: 'https://support.google.com/cloud/answer/15549945',
    },
    {
      id: 'linkedin', name: 'LinkedIn Direct Messages', state: 'partner_limited', sendingEnabled: false, enabled: false,
      note: "LinkedIn's official Messages API is limited to approved partners and member-initiated sends.",
      reference: 'https://learn.microsoft.com/en-us/linkedin/shared/integrations/communications/messages',
    },
    {
      id: 'x', name: 'X (formerly Twitter)', state: 'unverified', sendingEnabled: false, enabled: false,
      note: 'Not built. API access and price are not verified.',
    },
  ];
}
