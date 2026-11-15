import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, getUser } from '../auth/auth.js';
import { changeStatus } from '../services/requests.js';
import { REQUEST_STATUS, type RequestStatus } from '@edugestao/shared';

export const requestsRouter = Router();
requestsRouter.use(requireAuth);

/** Lista com filtro/busca/ordenação/paginação. */
requestsRouter.get('/', async (req, res) => {
  const { status, q, sort = 'recent', page = '1', pageSize = '20' } = req.query as Record<
    string,
    string
  >;
  const where: Record<string, unknown> = {};
  if (status && status in REQUEST_STATUS) where.status = status;
  if (q) {
    where.OR = [
      { senderName: { contains: q } },
      { senderEmail: { contains: q } },
      { subject: { contains: q } },
      { protocol: { contains: q } },
    ];
  }
  const take = Math.min(Number(pageSize) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [total, items] = await Promise.all([
    prisma.request.count({ where }),
    prisma.request.findMany({
      where,
      orderBy: sort === 'oldest' ? { createdAt: 'asc' } : { lastActivityAt: 'desc' },
      take,
      skip,
      include: { _count: { select: { messages: true } } },
    }),
  ]);
  res.json({ total, items });
});

/** Detalhe com histórico cronológico completo. */
requestsRouter.get('/:id', async (req, res) => {
  const request = await prisma.request.findUnique({
    where: { id: req.params.id },
    include: {
      officialPerson: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { attachments: true },
      },
      statusLogs: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!request) {
    res.status(404).json({ error: 'Solicitação não encontrada.' });
    return;
  }
  res.json(request);
});

const statusSchema = z.object({
  status: z.enum(
    Object.values(REQUEST_STATUS) as [RequestStatus, ...RequestStatus[]],
  ),
  reason: z.string().optional(),
});

requestsRouter.post('/:id/status', async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Status inválido.' });
    return;
  }
  const actor = getUser(req)?.email ?? 'desconhecido';
  const result = await changeStatus(
    req.params.id,
    parsed.data.status,
    actor,
    parsed.data.reason,
  );
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json({ ok: true });
});
