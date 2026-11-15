import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, getUser } from '../auth/auth.js';
import { QUEUE_STATE, COMMUNICATION_KIND, type CommunicationKind } from '@edugestao/shared';
import { processQueueBatch } from '../services/queue.js';
import { getAutomation } from '../services/settings.js';
import { gmailTestConnection } from '../integrations/gmail.js';
import { audit } from '../services/audit.js';

export const queueRouter = Router();
queueRouter.use(requireAuth);

queueRouter.get('/', async (_req, res) => {
  const items = await prisma.outboundQueue.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  res.json({ items });
});

/** Cria um rascunho de comunicação (não envia). */
const draftSchema = z.object({
  requestId: z.string().optional(),
  kind: z.enum(Object.values(COMMUNICATION_KIND) as [CommunicationKind, ...CommunicationKind[]]),
  toAddress: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
});

queueRouter.post('/draft', async (req, res) => {
  const parsed = draftSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Dados do rascunho inválidos.' });
    return;
  }
  const item = await prisma.outboundQueue.create({
    data: { ...parsed.data, state: QUEUE_STATE.RASCUNHO },
  });
  res.json(item);
});

/** Aprova um item — exige ação explícita do admin antes de qualquer envio. */
queueRouter.post('/:id/approve', async (req, res) => {
  const actor = getUser(req)?.email ?? 'desconhecido';
  const item = await prisma.outboundQueue.findUnique({ where: { id: req.params.id } });
  if (!item) {
    res.status(404).json({ error: 'Item não encontrado.' });
    return;
  }
  await prisma.outboundQueue.update({
    where: { id: req.params.id },
    data: { state: QUEUE_STATE.APROVADA, approvedBy: actor, approvedAt: new Date() },
  });
  await audit({ action: 'QUEUE_APPROVE', entityType: 'OutboundQueue', entityId: item.id });
  res.json({ ok: true });
});

queueRouter.post('/:id/cancel', async (req, res) => {
  await prisma.outboundQueue.update({
    where: { id: req.params.id },
    data: { state: QUEUE_STATE.CANCELADA },
  });
  res.json({ ok: true });
});

/**
 * INICIAR ENVIO DOS PEDIDOS — dispara o primeiro lote imediatamente.
 * Verifica a conexão Gmail antes; só envia itens aprovados.
 */
queueRouter.post('/start', async (_req, res) => {
  const conn = await gmailTestConnection('SEND');
  if (!conn.ok) {
    res.status(400).json({ error: `Gmail (envio) não conectado: ${conn.error}` });
    return;
  }
  const automation = await getAutomation();
  const result = await processQueueBatch(automation.queueBatchSize);
  await audit({ action: 'QUEUE_START', entityType: 'OutboundQueue', metadata: result });
  res.json({
    ...result,
    message: `Lote processado. Próximo lote em ${automation.queueIntervalMinutes} min (worker).`,
  });
});
