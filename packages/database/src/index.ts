import { PrismaClient } from '@prisma/client';

/**
 * Shared Prisma client for apps/engine and workers.
 * Singleton pattern prevents connection-pool exhaustion during
 * hot-reload and within the 50-connection Postgres budget (ADR-003).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export * from '@prisma/client';
export default prisma;
