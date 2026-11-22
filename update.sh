#!/usr/bin/env bash
# Read-only plan by default. The explicit execute mode is for a separately approved release.
# Never source .env as shell code. See scripts/ops/RELEASE.md.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
exec node scripts/ops/release.mjs "$@"
