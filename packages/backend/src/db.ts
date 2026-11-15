// Client gerado em caminho determinístico (ver schema.prisma `output`).
// Facilita o empacotamento do app desktop: o client acompanha o backend.
import { PrismaClient } from '../generated/prisma-client/index.js';

/**
 * Prisma Client único e compartilhado. Logging restrito a erro/aviso — nunca
 * logar queries em ambientes com dados reais (PII).
 */
export const prisma = new PrismaClient({
  log: ['error', 'warn'],
});
