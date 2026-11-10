FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY . .
RUN npm ci --no-audit --no-fund
RUN DATABASE_URL=postgresql://synthetic:synthetic@localhost:5432/leadloom npm run prisma:generate --workspace @leadloom/database
RUN npm run build --workspace @leadloom/contracts && npm run build --workspace @leadloom/database && npm run build --workspace @leadloom/engine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000
USER node
EXPOSE 4000
CMD ["node", "apps/engine/dist/main.js"]
