#!/usr/bin/env bash
# Adds MISSING login settings to .env. Never overwrites an existing value, never prints a secret,
# never touches other keys. Run on the host before update.sh:
#   bash scripts/ops/ensure-env.sh [--mail-from-bakerypos /path/to/bakerypos/.env]
# --mail-from-bakerypos copies that file's SMTP_PASS (the shared Resend key, only if host=smtp.resend.com, user=resend, key starts re_, from-address on mail.dmpilot.org) into
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
  val() { grep -m1 "^$1=" "$src" | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//" || true; }
  # BakeryPOS names (from its .env.example and email.service.ts): SMTP_HOST SMTP_USER SMTP_PASS SMTP_FROM
  host="$(val SMTP_HOST)"; user="$(val SMTP_USER)"; pass="$(val SMTP_PASS)"; from="$(val SMTP_FROM)"
  [ "$host" = "smtp.resend.com" ] && [ "$user" = "resend" ] || { echo "BakeryPOS mail is not Resend SMTP (host/user differ); not copying" >&2; exit 1; }
  case "$pass" in re_?*) ;; *) echo "SMTP_PASS is empty or not a Resend key (expected re_...); not copying" >&2; exit 1;; esac
  case "$from" in *"@mail.dmpilot.org"*|*"@mail.dmpilot.org>"*) ;; *) echo "SMTP_FROM is not on mail.dmpilot.org; not copying" >&2; exit 1;; esac
  has LEADLOOM_RESEND_API_KEY || put LEADLOOM_RESEND_API_KEY "$pass"
  has LEADLOOM_EMAIL_FROM || put LEADLOOM_EMAIL_FROM '"Leadloom <noreply@mail.dmpilot.org>"'
  has LEADLOOM_TRANSACTIONAL_EMAIL_ENABLED || put LEADLOOM_TRANSACTIONAL_EMAIL_ENABLED true
  has LEADLOOM_PASSWORD_AUTH_ENABLED || put LEADLOOM_PASSWORD_AUTH_ENABLED true
fi

echo "--- status (names only) ---"
for k in AUTH_SECRET LEADLOOM_NEXTAUTH_BRIDGE_SECRET AUTH_GITHUB_ID AUTH_GITHUB_SECRET LEADLOOM_RESEND_API_KEY LEADLOOM_PASSWORD_AUTH_ENABLED; do
  has "$k" && echo "set     $k" || echo "MISSING $k"
done
echo "Missing GitHub settings: add them with: bash scripts/ops/set-secret.sh AUTH_GITHUB_ID (then AUTH_GITHUB_SECRET)"
