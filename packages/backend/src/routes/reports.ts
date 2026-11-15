import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/auth.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

/** Resumo administrativo consolidado para relatórios (base de PDF/Excel no front). */
reportsRouter.get('/summary', async (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const range: Record<string, Date> = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);
  const createdFilter = Object.keys(range).length ? { createdAt: range } : {};

  const [
    received,
    responded,
    pending,
    awaitingCorrection,
    correctionsSent,
    inboundReceived,
    thanksSent,
  ] = await Promise.all([
    prisma.request.count({ where: createdFilter }),
    prisma.request.count({ where: { ...createdFilter, status: 'RESPONDIDA' } }),
    prisma.request.count({ where: { ...createdFilter, status: 'PENDENTE' } }),
    prisma.request.count({ where: { ...createdFilter, status: 'AGUARDANDO_CORRECAO' } }),
    prisma.message.count({ where: { direction: 'OUTBOUND', kind: 'CORRECAO' } }),
    prisma.message.count({ where: { direction: 'INBOUND' } }),
    prisma.message.count({ where: { direction: 'OUTBOUND', kind: 'AGRADECIMENTO' } }),
  ]);

  // Tempo médio de atendimento (criação → arquivamento), em horas.
  const closed = await prisma.request.findMany({
    where: { archivedAt: { not: null } },
    select: { createdAt: true, archivedAt: true },
  });
  const avgHours =
    closed.length === 0
      ? 0
      : closed.reduce(
          (acc, r) =>
            acc + (r.archivedAt!.getTime() - r.createdAt.getTime()) / 3_600_000,
          0,
        ) / closed.length;

  res.json({
    received,
    responded,
    pending,
    awaitingCorrection,
    correctionsSent,
    inboundReceived,
    thanksSent,
    avgResolutionHours: Math.round(avgHours * 10) / 10,
  });
});
