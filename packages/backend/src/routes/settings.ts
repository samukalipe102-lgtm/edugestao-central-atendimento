import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.js';
import {
  getAutomation,
  setAutomation,
  getSignature,
  setSignature,
} from '../services/settings.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get('/', async (_req, res) => {
  const [automation, signature] = await Promise.all([getAutomation(), getSignature()]);
  res.json({ automation, signature });
});

const automationSchema = z.object({
  pollIntervalMinutes: z.number().int().min(1).max(120).optional(),
  autoSyncEnabled: z.boolean().optional(),
  queueBatchSize: z.number().int().min(1).max(50).optional(),
  queueIntervalMinutes: z.number().int().min(1).max(120).optional(),
  pauseAfterFailures: z.number().int().min(1).max(100).optional(),
  workStartHour: z.number().int().min(0).max(23).optional(),
  workEndHour: z.number().int().min(0).max(23).optional(),
});

settingsRouter.put('/automation', async (req, res) => {
  const parsed = automationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Configuração inválida.' });
    return;
  }
  await setAutomation(parsed.data);
  res.json(await getAutomation());
});

settingsRouter.put('/signature', async (req, res) => {
  const text = z.object({ signature: z.string().min(1) }).safeParse(req.body);
  if (!text.success) {
    res.status(400).json({ error: 'Assinatura inválida.' });
    return;
  }
  await setSignature(text.data.signature);
  res.json({ signature: await getSignature() });
});
