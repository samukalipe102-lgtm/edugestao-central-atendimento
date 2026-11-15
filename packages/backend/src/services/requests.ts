import { prisma } from '../db.js';
import { canTransition, type RequestStatus } from '@edugestao/shared';
import { audit } from './audit.js';

/** Muda o status de uma solicitação respeitando as transições válidas. */
export async function changeStatus(
  requestId: string,
  to: RequestStatus,
  actor: string,
  reason?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const req = await prisma.request.findUnique({ where: { id: requestId } });
  if (!req) return { ok: false, error: 'Solicitação não encontrada.' };

  const from = req.status as RequestStatus;
  if (from === to) return { ok: true };
  if (!canTransition(from, to)) {
    return { ok: false, error: `Transição inválida: ${from} → ${to}.` };
  }

  await prisma.$transaction([
    prisma.request.update({
      where: { id: requestId },
      data: {
        status: to,
        lastActivityAt: new Date(),
        archivedAt: to === 'ARQUIVADA' ? new Date() : null,
      },
    }),
    prisma.statusLog.create({
      data: { requestId, fromStatus: from, toStatus: to, actor, reason },
    }),
  ]);
  await audit({
    action: 'STATUS_CHANGE',
    entityType: 'Request',
    entityId: requestId,
    metadata: { from, to, reason },
  });
  return { ok: true };
}

/** Tenta localizar uma pessoa oficial do EduGestão pelo e-mail do remetente. */
export async function findOfficialByEmail(email: string) {
  return prisma.officialPerson.findFirst({
    where: { email: { equals: email } },
  });
}
