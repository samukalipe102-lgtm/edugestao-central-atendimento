import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/auth.js';
import {
  gmailAuthUrl,
  gmailConfigured,
  gmailHandleCallback,
  gmailTestConnection,
} from '../integrations/gmail.js';
import {
  outlookAuthUrl,
  outlookConfigured,
  outlookHandleCallback,
  outlookTestConnection,
} from '../integrations/outlook.js';

export const integrationsRouter = Router();

/** Situação das integrações (público para o admin logado). */
integrationsRouter.get('/status', requireAuth, async (_req, res) => {
  const accounts = await prisma.mailAccount.findMany({
    select: {
      provider: true,
      emailAddress: true,
      purpose: true,
      connected: true,
      lastSyncAt: true,
      lastError: true,
    },
  });
  res.json({
    gmail: {
      configured: gmailConfigured(),
      account: accounts.find((a) => a.provider === 'GMAIL') ?? null,
    },
    outlook: {
      configured: outlookConfigured(),
      account: accounts.find((a) => a.provider === 'OUTLOOK') ?? null,
    },
  });
});

// --- Gmail OAuth ---
integrationsRouter.get('/gmail/connect', requireAuth, (_req, res) => {
  if (!gmailConfigured()) {
    res.status(400).json({ error: 'Credenciais do Gmail não configuradas (.env).' });
    return;
  }
  res.json({ url: gmailAuthUrl() });
});

integrationsRouter.get('/gmail/callback', async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.status(400).send('Código de autorização ausente.');
    return;
  }
  const result = await gmailHandleCallback(code);
  res
    .status(result.ok ? 200 : 400)
    .send(
      result.ok
        ? `Gmail conectado: ${result.value}. Pode fechar esta aba.`
        : `Falha: ${result.error}`,
    );
});

integrationsRouter.post('/gmail/test', requireAuth, async (_req, res) => {
  const result = await gmailTestConnection();
  res.status(result.ok ? 200 : 400).json(result.ok ? result.value : { error: result.error });
});

// --- Outlook OAuth ---
integrationsRouter.get('/outlook/connect', requireAuth, (_req, res) => {
  if (!outlookConfigured()) {
    res.status(400).json({ error: 'Credenciais do Outlook não configuradas (.env).' });
    return;
  }
  res.json({ url: outlookAuthUrl() });
});

integrationsRouter.get('/outlook/callback', async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.status(400).send('Código de autorização ausente.');
    return;
  }
  const result = await outlookHandleCallback(code);
  res
    .status(result.ok ? 200 : 400)
    .send(
      result.ok
        ? `Outlook conectado: ${result.value}. Pode fechar esta aba.`
        : `Falha: ${result.error}`,
    );
});

integrationsRouter.post('/outlook/test', requireAuth, async (_req, res) => {
  const result = await outlookTestConnection();
  res.status(result.ok ? 200 : 400).json(result.ok ? result.value : { error: result.error });
});
