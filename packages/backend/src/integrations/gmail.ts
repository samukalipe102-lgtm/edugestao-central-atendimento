import { google } from 'googleapis';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { decryptToken, encryptToken } from '../security/tokenVault.js';
import { err, ok, type Result } from '@edugestao/shared';

/**
 * Integração real com DUAS contas Gmail, usando um único app OAuth do Google Cloud:
 *   - ENVIO     (secretariaedugestao@gmail.com)  escopo gmail.send
 *   - RECEBIMENTO (admsedugestao@gmail.com)       escopo gmail.readonly
 *
 * Tokens guardados cifrados; nunca senhas. Tudo gratuito (Gmail API).
 */

export type GmailRole = 'SEND' | 'RECV';

interface RoleConfig {
  provider: 'GMAIL_SEND' | 'GMAIL_RECV';
  purpose: 'ENVIO' | 'RECEBIMENTO';
  scopes: string[];
  redirectUri: string;
}

const ROLES: Record<GmailRole, RoleConfig> = {
  SEND: {
    provider: 'GMAIL_SEND',
    purpose: 'ENVIO',
    scopes: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    redirectUri: config.gmail.sendRedirectUri,
  },
  RECV: {
    provider: 'GMAIL_RECV',
    purpose: 'RECEBIMENTO',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    redirectUri: config.gmail.recvRedirectUri,
  },
};

function oauthClient(role: GmailRole) {
  return new google.auth.OAuth2(
    config.gmail.clientId,
    config.gmail.clientSecret,
    ROLES[role].redirectUri,
  );
}

/** URL para o admin autorizar o acesso a uma das contas Gmail. */
export function gmailAuthUrl(role: GmailRole): string {
  return oauthClient(role).generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ROLES[role].scopes,
  });
}

/** Troca o código por tokens e persiste a conta do papel indicado. */
export async function gmailHandleCallback(
  role: GmailRole,
  code: string,
): Promise<Result<string>> {
  const roleCfg = ROLES[role];
  try {
    const client = oauthClient(role);
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token) return err('Google não retornou access_token.');

    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const me = await oauth2.userinfo.get();
    const email = me.data.email ?? 'desconhecido';

    await prisma.mailAccount.upsert({
      where: { provider: roleCfg.provider },
      create: {
        provider: roleCfg.provider,
        emailAddress: email,
        purpose: roleCfg.purpose,
        accessToken: tokens.access_token ? encryptToken(tokens.access_token) : null,
        refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scope: roleCfg.scopes.join(' '),
        connected: true,
        lastError: null,
      },
      update: {
        emailAddress: email,
        accessToken: tokens.access_token ? encryptToken(tokens.access_token) : undefined,
        refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : undefined,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        connected: true,
        lastError: null,
      },
    });
    return ok(email);
  } catch (e) {
    return err(`Falha ao concluir OAuth do Gmail (${role}): ${(e as Error).message}`);
  }
}

async function authedClient(role: GmailRole): Promise<Result<ReturnType<typeof oauthClient>>> {
  const account = await prisma.mailAccount.findUnique({
    where: { provider: ROLES[role].provider },
  });
  if (!account || !account.connected || !account.refreshToken) {
    return err(`Conta Gmail (${role}) não conectada.`);
  }
  const client = oauthClient(role);
  client.setCredentials({
    refresh_token: decryptToken(account.refreshToken),
    access_token: account.accessToken ? decryptToken(account.accessToken) : undefined,
    expiry_date: account.tokenExpiry?.getTime(),
  });
  return ok(client);
}

/** Testa a conexão de uma das contas (consulta o perfil). */
export async function gmailTestConnection(role: GmailRole): Promise<Result<{ email: string }>> {
  const c = await authedClient(role);
  if (!c.ok) return c;
  try {
    const gmail = google.gmail({ version: 'v1', auth: c.value });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    return ok({ email: profile.data.emailAddress ?? 'desconhecido' });
  } catch (e) {
    await prisma.mailAccount.update({
      where: { provider: ROLES[role].provider },
      data: { lastError: (e as Error).message },
    });
    return err(`Teste de conexão Gmail (${role}) falhou: ${(e as Error).message}`);
  }
}

/* --------------------------------- ENVIO --------------------------------- */

export interface OutgoingEmail {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  fromName?: string;
  fromAddress: string;
}

function buildRawMessage(email: OutgoingEmail): string {
  const from = email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress;
  const headers = [
    `From: ${from}`,
    `To: ${email.to}`,
    `Subject: ${email.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
  ];
  if (email.inReplyTo) headers.push(`In-Reply-To: ${email.inReplyTo}`);
  if (email.references) headers.push(`References: ${email.references}`);
  const raw = `${headers.join('\r\n')}\r\n\r\n${email.body}`;
  return Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Envia pela conta de ENVIO. Só retorna ok quando a API devolve um id;
 * recupera o Message-ID real para vinculação. Aceitação da API ≠ entrega.
 */
export async function gmailSend(
  email: OutgoingEmail,
): Promise<Result<{ messageId: string; providerMsgId: string }>> {
  const c = await authedClient('SEND');
  if (!c.ok) return c;
  try {
    const gmail = google.gmail({ version: 'v1', auth: c.value });
    const sent = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: buildRawMessage(email) },
    });
    const providerMsgId = sent.data.id;
    if (!providerMsgId) return err('Gmail aceitou mas não retornou id da mensagem.');

    const meta = await gmail.users.messages.get({
      userId: 'me',
      id: providerMsgId,
      format: 'metadata',
      metadataHeaders: ['Message-ID'],
    });
    const messageId =
      meta.data.payload?.headers?.find((h) => h.name?.toLowerCase() === 'message-id')?.value ??
      `gmail-${providerMsgId}`;

    return ok({ messageId, providerMsgId });
  } catch (e) {
    return err(`Falha no envio pelo Gmail: ${(e as Error).message}`);
  }
}

/* ------------------------------ RECEBIMENTO ------------------------------ */

export interface InboundMessage {
  providerMsgId: string;
  internetMessageId: string;
  inReplyTo?: string;
  references?: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  body: string;
  receivedAt: Date;
  hasAttachments: boolean;
}

function header(headers: { name?: string | null; value?: string | null }[], name: string) {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined;
}

function parseFrom(raw: string | undefined): { name: string; address: string } {
  if (!raw) return { name: '', address: '' };
  const m = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  if (m) return { name: m[1].trim(), address: m[2].trim() };
  return { name: '', address: raw.trim() };
}

/** Decodifica o corpo (base64url) do payload Gmail, preferindo text/html. */
function extractBody(payload: {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: unknown[];
}): string {
  const decode = (data?: string | null) =>
    data ? Buffer.from(data, 'base64url').toString('utf8') : '';

  if (payload.body?.data) return decode(payload.body.data);

  const parts = (payload.parts ?? []) as {
    mimeType?: string;
    body?: { data?: string };
    parts?: unknown[];
  }[];
  const html = parts.find((p) => p.mimeType === 'text/html');
  if (html?.body?.data) return decode(html.body.data);
  const text = parts.find((p) => p.mimeType === 'text/plain');
  if (text?.body?.data) return decode(text.body.data);
  // Multipart aninhado.
  for (const p of parts) {
    if (p.parts) {
      const nested = extractBody(p as never);
      if (nested) return nested;
    }
  }
  return '';
}

/**
 * Busca mensagens recebidas na caixa de entrada da conta de RECEBIMENTO
 * desde `since`. Traz os cabeçalhos de internet para vinculação confiável.
 */
export async function gmailFetchMessages(since: Date | null): Promise<Result<InboundMessage[]>> {
  const c = await authedClient('RECV');
  if (!c.ok) return c;
  try {
    const gmail = google.gmail({ version: 'v1', auth: c.value });
    // Filtro por data (Gmail usa segundos epoch no operador after:).
    const q = since ? `in:inbox after:${Math.floor(since.getTime() / 1000)}` : 'in:inbox';
    const list = await gmail.users.messages.list({ userId: 'me', q, maxResults: 25 });
    const ids = (list.data.messages ?? []).map((m) => m.id!).filter(Boolean);

    const messages: InboundMessage[] = [];
    for (const id of ids) {
      const full = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });
      const payload = full.data.payload;
      const headers = payload?.headers ?? [];
      const from = parseFrom(header(headers, 'From'));
      const dateHeader = header(headers, 'Date');
      const hasAttachments =
        (payload?.parts ?? []).some(
          (p) => p.filename && p.filename.length > 0,
        ) ?? false;

      messages.push({
        providerMsgId: id,
        internetMessageId: header(headers, 'Message-ID') ?? `gmail-recv-${id}`,
        inReplyTo: header(headers, 'In-Reply-To'),
        references: header(headers, 'References'),
        fromName: from.name,
        fromAddress: from.address,
        subject: header(headers, 'Subject') ?? '(sem assunto)',
        body: extractBody(payload ?? {}),
        receivedAt: dateHeader ? new Date(dateHeader) : new Date(),
        hasAttachments,
      });
    }
    return ok(messages);
  } catch (e) {
    await prisma.mailAccount.update({
      where: { provider: 'GMAIL_RECV' },
      data: { lastError: (e as Error).message },
    });
    return err(`Falha ao buscar e-mails (recebimento): ${(e as Error).message}`);
  }
}

export function gmailConfigured(): boolean {
  return config.gmail.configured();
}
