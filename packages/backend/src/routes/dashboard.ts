import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/auth.js';
import { REQUEST_STATUS } from '@edugestao/shared';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get('/', async (_req, res) => {
  const statuses = Object.values(REQUEST_STATUS);
  const counts = await prisma.request.groupBy({ by: ['status'], _count: true });
  const byStatus: Record<string, number> = Object.fromEntries(statuses.map((s) => [s, 0]));
  for (const row of counts) byStatus[row.status] = row._count;

  const [totalMessages, recentRequests, recentActivity, accounts] = await Promise.all([
    prisma.message.count(),
    prisma.request.findMany({
      orderBy: { lastActivityAt: 'desc' },
      take: 8,
      select: {
        id: true,
        protocol: true,
        senderName: true,
        subject: true,
        status: true,
        lastActivityAt: true,
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { action: true, entityType: true, createdAt: true, metadata: true },
    }),
    prisma.mailAccount.findMany({
      select: { provider: true, connected: true, lastError: true, lastSyncAt: true },
    }),
  ]);

  // Volume por dia (últimos 14 dias).
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const recent = await prisma.request.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
  });
  const volumeByDay: Record<string, number> = {};
  for (const r of recent) {
    const day = r.createdAt.toISOString().slice(0, 10);
    volumeByDay[day] = (volumeByDay[day] ?? 0) + 1;
  }

  res.json({
    totalEmails: totalMessages,
    byStatus,
    recentRequests,
    recentActivity,
    integrations: accounts,
    volumeByDay,
  });
});
