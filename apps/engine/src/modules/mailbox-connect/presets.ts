/** Provider presets and plain-language setup steps shown in the app. Hosts and ports are public settings, not secrets. */
export interface MailboxPreset {
  id: 'gmail' | 'outlook' | 'yahoo' | 'custom';
  label: string;
  smtpHost: string; smtpPort: number; imapHost: string; imapPort: number;
  secretLabel: string;
  steps: string[];
  sourceUrl: string | null;
  caveat: string | null;
}

export const MAILBOX_PRESETS: MailboxPreset[] = [
  {
    id: 'gmail', label: 'Gmail / Google Workspace',
    smtpHost: 'smtp.gmail.com', smtpPort: 465, imapHost: 'imap.gmail.com', imapPort: 993,
    secretLabel: 'App password (16 characters)',
    steps: [
      'Turn on 2-Step Verification for the Google account (app passwords need it).',
      'Create an app password in your Google Account security settings and copy the 16 characters.',
      'Paste it here with the full Gmail address. It is not your normal Google password.',
      'On Google Workspace, an admin can disable app passwords; if so, ask the admin or use OAuth later.',
    ],
    sourceUrl: 'https://support.google.com/mail/answer/185833',
    caveat: 'Google says app passwords are not recommended where "Sign in with Google" is possible. OAuth connect needs a Google Cloud OAuth app and is not built yet.',
  },
  {
    id: 'outlook', label: 'Microsoft 365 / Outlook',
    smtpHost: 'smtp.office365.com', smtpPort: 587, imapHost: 'outlook.office365.com', imapPort: 993,
    secretLabel: 'Password or app password',
    steps: [
      'Ask your Microsoft 365 admin whether SMTP AUTH and IMAP with a password are enabled for this mailbox.',
      'Use the full mailbox address and its password or app password.',
    ],
    sourceUrl: null,
    caveat: 'Many Microsoft tenants disable password sign-in for IMAP/SMTP; the connection test will say so. Not verified against a live Microsoft tenant.',
  },
  {
    id: 'yahoo', label: 'Yahoo Mail',
    smtpHost: 'smtp.mail.yahoo.com', smtpPort: 465, imapHost: 'imap.mail.yahoo.com', imapPort: 993,
    secretLabel: 'App password',
    steps: ['Create an app password in your Yahoo account security settings.', 'Paste it here with the full address.'],
    sourceUrl: null,
    caveat: 'Preset values are common defaults and have not been verified against a live Yahoo account.',
  },
  {
    id: 'custom', label: 'Other (IMAP + SMTP)',
    smtpHost: '', smtpPort: 587, imapHost: '', imapPort: 993,
    secretLabel: 'Mailbox password',
    steps: ['Get the SMTP and IMAP host names and ports from your mail provider.', 'Use the full address and its password.'],
    sourceUrl: null, caveat: null,
  },
];
