import { prisma } from '../db.js';

/**
 * Gera um número de protocolo único (EDU-YYYY-NNNNNN), sequencial por ano.
 * Só deve ser chamado DEPOIS de confirmar o vínculo com um dado oficial.
 */
export async function generateProtocol(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EDU-${year}-`;
  const last = await prisma.request.findFirst({
    where: { protocol: { startsWith: prefix } },
    orderBy: { protocol: 'desc' },
    select: { protocol: true },
  });
  const lastSeq = last?.protocol ? Number(last.protocol.slice(prefix.length)) : 0;
  const next = String(lastSeq + 1).padStart(6, '0');
  return `${prefix}${next}`;
}
