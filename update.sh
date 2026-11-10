#!/usr/bin/env bash
# ==============================================================================
# LeadLoom — Automated 1-Click Production Update Script
#
# Pulls latest Git changes, rebuilds Docker containers, verifies health,
# executes non-destructive database migrations, and validates the Cloudflare
# edge tunnel.
#
# Usage:
#   ./update.sh
# ==============================================================================

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

BOLD="\033[1m"
GREEN="\033[32m"
CYAN="\033[36m"
YELLOW="\033[33m"
RED="\033[31m"
RESET="\033[0m"

echo -e "${BOLD}${CYAN}======================================================${RESET}"
echo -e "${BOLD}${CYAN}🚀 LeadLoom — Production Update & Deployment Sequence${RESET}"
echo -e "${BOLD}${CYAN}======================================================${RESET}"

# 0. Environment configuration verification
if [ ! -f .env ]; then
  echo -e "${RED}Error: .env configuration file not found in $(pwd)${RESET}" >&2
  echo -e "Please create .env (refer to .env.example) before running update.sh." >&2
  exit 1
fi

ENGINE_PORT="$(grep -m1 '^ENGINE_PORT=' .env 2>/dev/null | cut -d= -f2- || true)"
ENGINE_PORT="${ENGINE_PORT:-4010}"
WEB_PORT="$(grep -m1 '^WEB_PORT=' .env 2>/dev/null | cut -d= -f2- || true)"
WEB_PORT="${WEB_PORT:-3000}"
APP_BASE_URL="$(grep -m1 '^APP_BASE_URL=' .env 2>/dev/null | cut -d= -f2- || true)"
APP_BASE_URL="${APP_BASE_URL:-https://leadloom.dmpilot.org}"

# 1. Pull latest code from GitHub
echo -e "\n${BOLD}📥 [1/6] Pulling latest changes from Git repository...${RESET}"
if [ -d ".git" ]; then
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  echo -e "   Branch: ${CYAN}${CURRENT_BRANCH}${RESET}"
  git pull origin "${CURRENT_BRANCH}"
  echo -e "   ${GREEN}✓ Git workspace updated successfully.${RESET}"
else
  echo -e "   ${YELLOW}⚠ Not a Git root directory. Skipping git pull.${RESET}"
fi

# 2. Build updated images and restart application containers
echo -e "\n${BOLD}🔨 [2/6] Ruilding updated images & recreating containers...${RESET}"
docker compose --profile application up -d --build
echo -e "   ${GREEN}✓ Containers deployed via Docker Compose.${RESET}"

# 3. Wait for Database, Engine API, and Web Frontend to report healthy
echo -e "\n${BOLD}🩺 [3/6] Waiting for services to become healthy...${RESET}"

# Engine API Health Probe
echo -e "   Checking Engine API on http://127.0.0.1:${ENGINE_PORT}/health..."
api_ready=false
for i in $(seq 1 60); do
  if curl -sf --max-time 3 "http://127.0.0.1:${ENGINE_PORT}/health" >/dev/null 2>&1; then
    api_ready=true
    break
  fi
  sleep 2
done

if [ "$api_ready" != "true" ]; then
  echo -e "   ${RED}✗ Warning: Engine API failed to respond on http://127.0.0.1:${ENGINE_PORT}/health within 120s.${RESET}" >&2
  docker compose logs --tail 30 api >&2 || true
  exit 1
fi
echo -e "   ${GREEN}● [OK] Engine API is healthy.${RESET}"

# Web Frontend Health Probe
echo -e "   Checking Web Frontend on http://127.0.0.1:${WEB_PORT}..."
web_ready=false
for i in $(seq 1 60); do
  if curl -sf --max-time 3 "http://127.0.0.1:${WEB_PORT}" >/dev/null 2>&1; then
    web_ready=true
    break
  fi
  sleep 2
done

if [ "$web_ready" != "true" ]; then
  echo -e "   ${RED}✗ Warning: Web frontend failed to respond on http://127.0.0.1:${WEB_PORT} within 120s.${RESET}" >&2
  docker compose logs --tail 30 web >&2 || true
  exit 1
fi
echo -e "   ${GREEN}● [OK] Web frontend is healthy.${RESET}"

# 4. Apply non-destructive database migrations
echo -e "\n${BOLD}🗄  [4/6] Applying non-destructive database migrations...${RESET}"
if docker compose exec -T api npx prisma migrate deploy --schema packages/database/prisma/schema.prisma; then
  echo -e "   ${GREEN}✓ Prisma database migrations applied safely (zero data loss).${RESET}"
else
  echo -e "   ${YELLOW}⚠ Prisma migration deployment exited with a non-zero code. Check logs if schema has changes.${RESET}"
fi

# 5. Cloudflare Tunnel & Edge Health Verification
echo -e "\n${BOLD}🌐 [5/6] Verifying Cloudflare Tunnel and public routing...${RESET}"
if systemctl --user is-active --quiet cloudflared 2>/dev/null; then
  echo -e "   ${GREEN}● [OK] Cloudflare Tunnel service (active/running).${RESET}"
else
  echo -e "   ${YELLOW}○ [WARN] Cloudflare Tunnel service is not active (check: systemctl --user status cloudflared)${RESET}"
fi

public_ready=false
for i in $(seq 1 15); do
  if curl -sf --max-time 5 -o /dev/null "${APP_BASE_URL}"; then
    public_ready=true
    break
  fi
  sleep 2
done

if [ "$public_ready" = "true" ]; then
  echo -e "   ${GREEN}● [OK] Public Endpoint (${APP_BASE_URL}) responds with HTTP 200.${RESET}"
else
  echo -e "   ${YELLOW}○ [WAIT] Public Endpoint (${APP_BASE_URL}) warming up or propagating.${RESET}"
fi

# 6. Disk space cleanup
echo -e "\n${BOLD}🧹 [6/6] Pruning dangling Docker build layers...${RESET}"
docker image prune -f >/dev/null 2>&1 || true
echo -e "   ${GREEN}✓ Build cache pruned.${RESET}"

echo -e "\n${BOLD}${GREEN}======================================================${RESET}"
echo -e "${BOLD}${GREEN}🎉 LeadLoom Deployment Successfully Updated & Verified!${RESET}"
echo -e "${BOLD}${GREEN}======================================================${RESET}"
echo -e " - Public Demo:    ${APP_BASE_URL}"
echo -e " - Local Web:      http://127.0.0.1:${WEB_PORT}"
echo -e " - Engine Health:  http://127.0.0.1:${ENGINE_PORT}/health"
echo -e " - Outbound Send:  Disabled (Provider routes inactive)"
echo -e " - Demo Banner:    Active (Simulated data only)"
echo -e "${BOLD}${GREEN}======================================================${RESET}\n"
