# Mailbox connect: UI contract (Team B)

Status: engine done (source on `main`, a335e0f+), UI not built. Production does not have the migration or the flag.
Scope for the UI owner: ONLY `apps/web/app/app/mailboxes/page.tsx`, one new component folder `apps/web/components/mailboxes/`, and the row type in `apps/web/lib/engine-client.ts`. Do not touch engine, database, auth, or deploy files.

## Engine contract (call through the same-origin proxy `/api/engine/...`)
All routes are admin-only, per workspace, and return 404 unless the host sets `LEADLOOM_MAILBOX_CONNECT_ENABLED=true`. Treat 404 on `/workspace/mailbox-presets` as "feature not enabled on this server" and show a plain disabled card, not an error.

- `GET /workspace/mailbox-presets` -> `MailboxPreset[]`: `{id:'gmail'|'outlook'|'yahoo'|'custom', label, smtpHost, smtpPort, imapHost, imapPort, secretLabel, steps:string[], sourceUrl:string|null, caveat:string|null}`. Render `steps` as the numbered "what you need" list, `caveat` as a visible note, `sourceUrl` as a link. Custom has blank hosts: show host/port fields. Allowed ports: SMTP 25/465/587/2525, IMAP 143/993.
- `POST /workspace/mailboxes/connect` body (strict, no extra keys): `{email, password, smtpHost, smtpPort, imapHost, imapPort}`.
  - 201 `{mailbox:{id,email,connectionStatus,connectionErrorCode,connectionCheckedAt}, result:{smtp,imap}, mailSent:false}`
  - 400 `code` in invalid_email | invalid_password | invalid_host | private_host | invalid_port | invalid_request
  - 409 `already_connected`; 422 `connection_failed` with `result:{smtp,imap}` where each is ok|auth_failed|unreachable|timeout|tls_error|failed|skipped; 429 too many requests.
  - Nothing is saved unless the login works. No email is sent.
- `POST /workspace/mailboxes/:id/test` -> `{mailbox, result, mailSent:false}`; 404 if not found.
- `DELETE /workspace/mailboxes/:id` -> removes the mailbox and its stored password.
- `GET /workspace/mailboxes` rows now also carry `authType`, `connectionStatus`, `connectionCheckedAt`, `connectionErrorCode`.

## Required behavior
1. "Connect a mailbox" opens a panel: provider picker, then the preset's steps, then a form. The password field is `type=password`, `autocomplete=off`, cleared after every submit, never placed in a URL, log, toast or console. Label from `secretLabel`. One line under it: "Stored encrypted in Leadloom. We only check that the login works; no email is sent."
2. Map codes to plain messages (examples): auth_failed "The provider rejected this login. Check the address and the app password."; tls_error "The server's security certificate could not be verified."; timeout/unreachable "Could not reach the mail server."; private_host "That server address is not allowed."; already_connected "This address is already connected."
3. Mailbox rows show connection state (ok / failed + code / never checked), a "Test connection" button, and "Remove" with a confirm dialog. Non-admin members see the list but no connect/test/remove controls.
4. Honest status cards for providers not built: "Gmail sign-in (OAuth): not built. Needs a Google Cloud OAuth app; Google's verification rules apply (https://support.google.com/cloud/answer/15549945)." "LinkedIn: no official route for automated messages (https://learn.microsoft.com/en-us/linkedin/shared/integrations/communications/messages)." "X: not built; access and price not verified." No prices.
5. Follow DESIGN_RULES.md and existing page patterns. Add loading, empty and error states. Mobile width must not overflow.
6. Do not claim DNS/SPF/health from a password connect. Those columns stay unknown until checked.

## Done means
Verified in a real browser against a local engine (flag on, `LEADLOOM_MAILBOX_ALLOW_PRIVATE_HOSTS=true` with a local SMTP server), screenshots of: provider steps, failed login message, connected row, remove confirm, member view. Report the commit hash. Do not deploy.
