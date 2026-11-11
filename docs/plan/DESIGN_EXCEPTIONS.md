# Known design-rule exceptions (internal tracking)

Updated from `node scripts/check-design.mjs`. Remove a line when fixed.
- Direct `sonner` imports in fixture pages and modals: replaced by `lib/notify` in Beta task 3.
- Fixture pages (tables, connectors, mailboxes, campaigns, validator, admin) still use sample data; labelled, not real yet.
- Landing page (Alpha L0) not yet reworked to the light theme and mega menu; text cleaned only.
- Connectors modal still has a "[Demo mode]" simulation path.
- 3D scenes and OAuth provider marks use their own colors (allowed).
- Connectors page: all fixtures; Test Connection calls an engine route that does not exist (fails closed with an error). components/mailboxes/dns-inspector-modal.tsx is unreferenced and still contains invented DNS records; delete or rewrite before reuse.
- Mailboxes: add-mailbox and DNS check actions are disabled and say "not available yet".
