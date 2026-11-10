#!/usr/bin/env bash
# Adds MISSING login settings to .env. Never overwrites an existing value, never prints a secret,
# never touches other keys. Run on the host before update.sh:
#   bash scripts/ops/ensure-env.sh [--mail-from-bakerypos /path/to/bakerypos/.env]
# --mail-from-bakerypos copies that file's SMTP_PASSWORD (the shared Resend key) into
# LEADLOOM_RESEND_API_KEY on this host only, and turns on emailed codes with the sender below.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
[ -f .env ] || { echo "no .env here; refusing to create one" >&2; exit 1; }
has() { grep -Eq "^$1=.+" .env; }
put() { printf '%s=%s\n' "$1" "$2" >> .env; echo "added $1"; }
rnd() { head -c 32 /dev/urandom | base64 | tr -d '\n'; }
tail -c1 .env | read -r _ || printf '\n' >> .env

has AUTH_SECRET || put AUTH_SECRET "$(rnd)"
has LEADLOOM_NEXTAUTH_BRIDGE_SECRET || put LEADLOOM_NEXTAUTH_BRIDGE_SECRET "$(rnd)"
has LEADLOOM_NEXTAUTH_BRIDGE_ENABLED || put LEADLOOM_NEXTAUTH_BRIDGE_ENABLED true
has LEADLOOM_SELF_SIGNUP_ENABLED || put LEADLOOM_SELF_SIGNUP_ENABLED true
has LEADLOOM_SIGNUP_HOURLY_CAP || put LEADLOOM_SIGNUP_HOURLY_CAP 20

if [ "${1:-}" = "--mail-from-bakerypos" ]; then
  src="${2:?path to the BakeryPOS .env}"
  [ -f "$src" ] || { echo "BakeryPOS env not found" >&2; exit 1; }
  if ! has LEADLOOM_RESEND_API_KEY; then
    key="$(grep -m1 '^SMTP_PASSWORD=' "$src" | cut -d= -f2- | tr -d '"' || true)"
    [ -n "$key" ] || { echo "SMTP_PASSWORD not found in that file" >&2; exit 1; }
    put LEADLOOM_RESEND_API_KEY "$key"
  fi
  has LEADLOOM_EMAIL_FROM || put LEADLOOM_EMAIL_FROM '"Leadloom <noreply@mail.dmpilot.org>"'
  has LEADLOOM_TRANSACTIONAL_EMAIL_ENABLED || put LEADLOOM_TRANSACTIONAL_EMAIL_ENABLED true
  has LEADLOOM_PASSWORD_AUTH_ENABLED || put LEADLOOM_PASSWORD_AUTH_ENABLED true
fi

echo "--- status (names only) ---"
for k in AUTH_SECRET LEADLOOM_NEXTAUTH_BRIDGE_SECRET AUTH_GITHUB_ID AUTH_GITHUB_SECRET LEADLOOM_RESEND_API_KEY LEADLOOM_PASSWORD_AUTH_ENABLED; do
  has "$k" && echo "set     $k" || echo "MISSING $k"
done
echo "Missing GitHub settings: add them with: bash scripts/ops/set-secret.sh AUTH_GITHUB_ID (then AUTH_GITHUB_SECRET)"
