#!/bin/sh
# Stage 1 (login) local harness. DEV ONLY: throwaway secrets, local database, loopback only.
# Starts the engine with the NextAuth bridge and self sign-up ON, entitlements OFF.
# Usage: DATABASE_URL=postgresql://... sh scripts/dev/stage1-harness.sh [up|env|down]
# Also turns password auth ON with a LOCAL FILE mail sink (/tmp/leadloom-stage1-mail.jsonl, mode 600):
# verification/reset links land in that file, no mail is ever sent.
# Never writes .env, never deploys, never calls a provider, never sends mail.
set -eu
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENVF="${STAGE1_ENV_FILE:-/tmp/leadloom-stage1.env}"
PIDF="${STAGE1_PID_FILE:-/tmp/leadloom-stage1-engine.pid}"
cmd="${1:-up}"
rnd() { node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))"; }
case "$cmd" in
  env)
    if [ ! -f "$ENVF" ]; then
      umask 077
      { echo "LEADLOOM_MASTER_KEY=$(rnd)"; echo "LEADLOOM_SESSION_KEY=$(rnd)"
        echo "LEADLOOM_NEXTAUTH_BRIDGE_SECRET=$(rnd)"; echo "AUTH_SECRET=$(rnd)"; } > "$ENVF"
    fi
    echo "env file: $ENVF (mode 600, throwaway, not in the repo)";;
  up)
    : "${DATABASE_URL:?DATABASE_URL required}"
    case "$DATABASE_URL" in *localhost*|*127.0.0.1*|*host=/*) ;; *) echo "refusing: DATABASE_URL must be local" >&2; exit 2;; esac
    sh "$0" env >/dev/null
    set -a; . "$ENVF"; set +a
    export DATABASE_URL PORT="${PORT:-4100}" HOST=127.0.0.1
    export LEADLOOM_NEXTAUTH_BRIDGE_ENABLED=true LEADLOOM_SELF_SIGNUP_ENABLED=true
    export LEADLOOM_PASSWORD_AUTH_ENABLED=true LEADLOOM_PASSWORD_AUTH_BASE_URL="${STAGE1_WEB_ORIGIN:-http://localhost:3000}"
    export LEADLOOM_DEV_MAIL_SINK_FILE="${STAGE1_MAIL_FILE:-/tmp/leadloom-stage1-mail.jsonl}" NODE_ENV=development
    ( umask 077; : > "$LEADLOOM_DEV_MAIL_SINK_FILE" )
    (cd "$ROOT/packages/database" && {
      if echo "select 1 from users limit 1" | npx prisma db execute --stdin --schema prisma/schema.prisma >/dev/null 2>&1; then
        npx prisma migrate deploy --schema prisma/schema.prisma >/dev/null
      else
        sh scripts/bootstrap-fresh.sh >/dev/null
      fi; })
    if node -e "require('net').connect($PORT,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"; then echo "refusing: port $PORT already in use (run: sh $0 down)" >&2; exit 2; fi
    (cd "$ROOT/apps/engine" && setsid nohup npx tsx src/main.ts > /tmp/leadloom-stage1-engine.log 2>&1 & echo $! > "$PIDF")
    for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
      if node -e "fetch('http://127.0.0.1:$PORT/health').then(r=>r.json()).then(j=>{console.log(JSON.stringify(j));process.exit(0)}).catch(()=>process.exit(1))"; then exit 0; fi
      sleep 2
    done
    echo "engine did not come up; see /tmp/leadloom-stage1-engine.log" >&2; exit 1;;
  down)
    [ -f "$PIDF" ] && { P="$(cat "$PIDF")"; kill -- -"$P" 2>/dev/null || pkill -P "$P" 2>/dev/null || true; kill "$P" 2>/dev/null || true; }; rm -f "$PIDF"; echo stopped;;
  *) echo "usage: $0 [up|env|down]" >&2; exit 2;;
esac
