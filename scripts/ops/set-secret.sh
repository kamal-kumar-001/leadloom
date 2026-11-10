#!/usr/bin/env bash
# Prompts silently for one value and appends NAME=value to .env if NAME is not already set.
# The value is never echoed, logged, or passed on a command line.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
name="${1:?usage: set-secret.sh NAME}"
[[ "$name" =~ ^[A-Z0-9_]+$ ]] || { echo "bad name" >&2; exit 1; }
[ -f .env ] || { echo "no .env here" >&2; exit 1; }
if grep -Eq "^${name}=.+" .env; then echo "$name already set; not changing it"; exit 0; fi
read -r -s -p "$name: " val; echo
[ -n "$val" ] || { echo "empty; nothing written" >&2; exit 1; }
tail -c1 .env | read -r _ || printf '\n' >> .env
printf '%s=%s\n' "$name" "$val" >> .env
echo "saved $name"
