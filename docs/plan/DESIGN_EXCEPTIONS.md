# Known design-rule exceptions (internal tracking)

Updated from `node scripts/check-design.mjs`. Remove a line when fixed.
- Direct `sonner` imports in fixture pages and modals: replaced by `lib/notify` in Beta task 3.
- Fixture pages (tables, connectors, mailboxes, campaigns, validator, admin) still use sample data; labelled, not real yet.
- Landing page (Alpha L0) not yet reworked to the light theme and mega menu; text cleaned only.
- Connectors modal still has a "[Demo mode]" simulation path.
- 3D scenes and OAuth provider marks use their own colors (allowed).
