import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client único e compartilhado. Logging restrito a erro/aviso — nunca
 * logar queries em ambientes com dados reais (PII).
 */
export const prisma = new PrismaClient({
  log: ['error', 'warn'],
});
