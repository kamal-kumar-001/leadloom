FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN npm ci --no-audit --no-fund
# Next typechecks the checked-in operational fixtures as well as app routes.
# Their engine imports need the database workspace's generated client and types.
RUN DATABASE_URL=postgresql://synthetic:synthetic@localhost:5432/leadloom npm run prisma:generate --workspace @leadloom/database
RUN npm run build --workspace @leadloom/contracts && npm run build --workspace @leadloom/database && npm run build --workspace @leadloom/web

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
