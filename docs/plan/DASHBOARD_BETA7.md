# Dashboard Beta task 7: Settings team card (members and invitations)

Owner: Beta (web only). Engine contract is final for this task and lives in `apps/engine/src/main.ts`.
Read `docs/plan/DESIGN_RULES.md` first. It is binding. Use `@leadloom/ui`, `lib/notify`, tokens only.
Do not touch: landing files, logo and favicon, `apps/web/app/tokens.css`, engine, auth, migrations.
Your files: `apps/web/components/settings/team-settings-card.tsx` (rewrite) and new files under
`apps/web/components/settings/team/` and `apps/web/lib/team-api.ts`. Pull before you start and before every push.
Main branch only. Commit as Kamal <kamal-kumar-001@users.noreply.github.com>. Never force-push.

## What exists in the engine (same-origin proxy `/api/engine/...`, session attached server-side)
Admin only (403 for others), workspace comes from the session:
- `GET /workspace/members` -> `[{id,email,name,role,verified,active,createdAt}]`
- `PATCH /workspace/members/:id` body `{role}` (read_only | member | admin) -> `{updated:true}`
- `DELETE /workspace/members/:id` -> `{removed:true}` (suspends, never deletes data)
- `GET /workspace/invitations` -> `[{id,email,role,createdAt,expiresAt,status}]`
- `POST /workspace/invitations` body `{email,role}` -> 201 `{invitation,emailSent:false}`
- `DELETE /workspace/invitations/:id` -> `{revoked:true}`
Any signed-in role:
- `GET /me/invitations` -> `[{id,role,expiresAt,workspaceName,inviterName}]` (only for your verified address)
- `POST /me/invitations/:id/accept` -> `{accepted:true,role,reauthenticate:true}`
Error bodies carry `code`. Create: `invalid_email`, `invalid_role`, `account_exists` (409), `already_invited` (409),
`limit_reached` (429), `owner_only` (403: only the owner may invite an admin). Members: `not_found` 404,
`owner_protected` 409, `owner_only` 403, `last_admin` 409, `self` 409. Accept: `not_found` 404, `unverified`,
`already_member`, `has_workspace_data` (all 409).
The whole feature is behind a flag that is OFF on the live host. When the engine answers 404 for these routes, show an
honest "Team management is not available yet" state, not an error toast and not fake data.

## Rules that must show in the UI
- No invitation email is sent. Say so at the point of action: after creating, show "No email was sent. Ask them to sign up
  with this address, then open Settings and accept the invitation." No copyable link exists. Do not invent one.
- An address that already has an account cannot be invited (explicit message for `account_exists`; nothing is moved).
- The owner row is labelled Owner and has no role or remove controls. Only the owner sees "Admin" in the role pickers
  and in the invite form. Use the current user's id from the shell identity; the engine decides, the UI only hides.
- Remove asks for confirmation (`ConfirmDialog` pattern), and its copy says access is suspended and data is kept.
- Invitee card: when `/me/invitations` returns items, show workspace name, inviter, role, expiry and an Accept button.
  Copy must say accepting moves this account into that workspace, and that it only works for an account with no data of
  its own (`has_workspace_data` -> explain, no retry loop). After success show a notice that the user must sign in again.
- Unverified members show a "Not verified" badge. Pending, expired and revoked invitations use distinct badges.
- Feedback only through `lib/notify` with allow-listed safe messages. No raw engine text in the UI.
- No gate or lock icon for features that are not enforced. No invented plan limits or seat prices.

## Checks before you push
`node scripts/check-design.mjs`, `tsc`, build. Render dark and light at 390 and 1280 against a local engine with
throwaway rows. The flag is `LEADLOOM_TEAM_INVITES_ENABLED=true` on the local engine only. No deploy, no email, no provider
call. Report the commit and screenshots to Gamma. Do not mark done anything you did not render.
