import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/auth.js';
import {
  gmailAuthUrl,
  gmailConfigured,
  gmailHandleCallback,
  gmailTestConnection,
  type GmailRole,
} from '../integrations/gmail.js';

export const integrationsRouter = Router();

/** Mapeia o segmento da rota para o papel da conta. */
function roleFromPath(seg: string): GmailRole | null {
  if (seg === 'gmail-send') return 'SEND';
  if (seg === 'gmail-recv') return 'RECV';
  return null;
}

/** Situação das integrações (para o admin logado). */
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
    configured: gmailConfigured(),
    envio: {
      role: 'gmail-send',
      expected: 'secretariaedugestao@gmail.com',
      account: accounts.find((a) => a.provider === 'GMAIL_SEND') ?? null,
    },
    recebimento: {
      role: 'gmail-recv',
      expected: 'admsedugestao@gmail.com',
      account: accounts.find((a) => a.provider === 'GMAIL_RECV') ?? null,
    },
  });
});

// Conectar (gera a URL de autorização). :role = gmail-send | gmail-recv
integrationsRouter.get('/:role/connect', requireAuth, (req, res) => {
  const role = roleFromPath(req.params.role);
  if (!role) {
    res.status(404).json({ error: 'Integração desconhecida.' });
    return;
  }
  if (!gmailConfigured()) {
    res.status(400).json({ error: 'Credenciais do Google não configuradas (.env).' });
    return;
  }
  res.json({ url: gmailAuthUrl(role) });
});

// Callback do OAuth (aberto pelo Google; sem auth de sessão).
integrationsRouter.get('/:role/callback', async (req, res) => {
  const role = roleFromPath(req.params.role);
  if (!role) {
    res.status(404).send('Integração desconhecida.');
    return;
  }
  const code = req.query.code as string | undefined;
  if (!code) {
    res.status(400).send('Código de autorização ausente.');
    return;
  }
  const result = await gmailHandleCallback(role, code);
  const label = role === 'SEND' ? 'envio' : 'recebimento';
  res
    .status(result.ok ? 200 : 400)
    .send(
      result.ok
        ? `Conta de ${label} conectada: ${result.value}. Pode fechar esta aba.`
        : `Falha: ${result.error}`,
    );
});

// Testar conexão de verdade.
integrationsRouter.post('/:role/test', requireAuth, async (req, res) => {
  const role = roleFromPath(req.params.role);
  if (!role) {
    res.status(404).json({ error: 'Integração desconhecida.' });
    return;
  }
  const result = await gmailTestConnection(role);
  res.status(result.ok ? 200 : 400).json(result.ok ? result.value : { error: result.error });
});
