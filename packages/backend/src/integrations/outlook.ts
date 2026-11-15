import { config } from '../config.js';
import { prisma } from '../db.js';
import { decryptToken, encryptToken } from '../security/tokenVault.js';
import { err, ok, type Result } from '@edugestao/shared';

/**
 * Integração real com a conta de RECEBIMENTO (Outlook: admsedugestao@outlook.com).
 * Usa Microsoft Graph + OAuth 2.0 (fluxo authorization code).
 * Conta pessoal @outlook.com → tenant "consumers". Escopos limitados a leitura de e-mail.
 */

const MS_SCOPES = ['offline_access', 'User.Read', 'Mail.Read'];
const GRAPH = 'https://graph.microsoft.com/v1.0';

function authBase(): string {
  return `https://login.microsoftonline.com/${config.microsoft.tenant}/oauth2/v2.0`;
}

/** URL para o admin autorizar o acesso à conta Outlook. */
export function outlookAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: config.microsoft.clientId,
    response_type: 'code',
    redirect_uri: config.microsoft.redirectUri,
    response_mode: 'query',
    scope: MS_SCOPES.join(' '),
    prompt: 'consent',
  });
  return `${authBase()}/authorize?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

async function requestTokens(body: Record<string, string>): Promise<Result<TokenResponse>> {
  const res = await fetch(`${authBase()}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || data.error) {
    return err(data.error_description ?? data.error ?? `HTTP ${res.status}`);
  }
  return ok(data);
}

/** Troca o código de autorização por tokens e persiste a conta de recebimento. */
export async function outlookHandleCallback(code: string): Promise<Result<string>> {
  const tokens = await requestTokens({
    client_id: config.microsoft.clientId,
    client_secret: config.microsoft.clientSecret,
    code,
    redirect_uri: config.microsoft.redirectUri,
    grant_type: 'authorization_code',
    scope: MS_SCOPES.join(' '),
  });
  if (!tokens.ok) return err(`Falha no OAuth do Outlook: ${tokens.error}`);

  const me = await fetch(`${GRAPH}/me`, {
    headers: { Authorization: `Bearer ${tokens.value.access_token}` },
  });
  const profile = (await me.json()) as { mail?: string; userPrincipalName?: string };
  const email = profile.mail ?? profile.userPrincipalName ?? 'desconhecido';

  await prisma.mailAccount.upsert({
    where: { provider: 'OUTLOOK' },
    create: {
      provider: 'OUTLOOK',
      emailAddress: email,
      purpose: 'RECEBIMENTO',
      accessToken: encryptToken(tokens.value.access_token),
      refreshToken: tokens.value.refresh_token
        ? encryptToken(tokens.value.refresh_token)
        : null,
      tokenExpiry: new Date(Date.now() + tokens.value.expires_in * 1000),
      scope: MS_SCOPES.join(' '),
      connected: true,
      lastError: null,
    },
    update: {
      emailAddress: email,
      accessToken: encryptToken(tokens.value.access_token),
      refreshToken: tokens.value.refresh_token
        ? encryptToken(tokens.value.refresh_token)
        : undefined,
      tokenExpiry: new Date(Date.now() + tokens.value.expires_in * 1000),
      connected: true,
      lastError: null,
    },
  });
  return ok(email);
}

/** Garante um access_token válido, renovando pelo refresh_token se necessário. */
async function validAccessToken(): Promise<Result<string>> {
  const account = await prisma.mailAccount.findUnique({ where: { provider: 'OUTLOOK' } });
  if (!account || !account.connected) return err('Conta Outlook não conectada.');

  const stillValid =
    account.accessToken &&
    account.tokenExpiry &&
    account.tokenExpiry.getTime() - Date.now() > 60_000;
  if (stillValid) return ok(decryptToken(account.accessToken!));

  if (!account.refreshToken) return err('Sem refresh_token para renovar o Outlook.');
  const refreshed = await requestTokens({
    client_id: config.microsoft.clientId,
    client_secret: config.microsoft.clientSecret,
    refresh_token: decryptToken(account.refreshToken),
    grant_type: 'refresh_token',
    scope: MS_SCOPES.join(' '),
  });
  if (!refreshed.ok) {
    await prisma.mailAccount.update({
      where: { provider: 'OUTLOOK' },
      data: { lastError: refreshed.error, connected: false },
    });
    return err(`Falha ao renovar token do Outlook: ${refreshed.error}`);
  }
  await prisma.mailAccount.update({
    where: { provider: 'OUTLOOK' },
    data: {
      accessToken: encryptToken(refreshed.value.access_token),
      refreshToken: refreshed.value.refresh_token
        ? encryptToken(refreshed.value.refresh_token)
        : undefined,
      tokenExpiry: new Date(Date.now() + refreshed.value.expires_in * 1000),
      lastError: null,
    },
  });
  return ok(refreshed.value.access_token);
}

/** Testa a conexão realmente (consulta o perfil via Graph). */
export async function outlookTestConnection(): Promise<Result<{ email: string }>> {
  const token = await validAccessToken();
  if (!token.ok) return token;
  const res = await fetch(`${GRAPH}/me`, {
    headers: { Authorization: `Bearer ${token.value}` },
  });
  if (!res.ok) return err(`Teste de conexão Outlook falhou: HTTP ${res.status}`);
  const profile = (await res.json()) as { mail?: string; userPrincipalName?: string };
  return ok({ email: profile.mail ?? profile.userPrincipalName ?? 'desconhecido' });
}

export interface InboundMessage {
  providerMsgId: string;
  internetMessageId: string; // Message-ID de internet, para vinculação
  inReplyTo?: string;
  references?: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  body: string;
  receivedAt: Date;
  hasAttachments: boolean;
}

/**
 * Busca mensagens recebidas desde `since`. Retorna cabeçalhos de internet
 * (Message-ID / In-Reply-To / References) para vinculação confiável.
 */
export async function outlookFetchMessages(
  since: Date | null,
): Promise<Result<InboundMessage[]>> {
  const token = await validAccessToken();
  if (!token.ok) return token;

  const select =
    'id,subject,from,receivedDateTime,hasAttachments,bodyPreview,body,internetMessageId,internetMessageHeaders';
  let url = `${GRAPH}/me/mailFolders/inbox/messages?$top=25&$orderby=receivedDateTime desc&$select=${select}`;
  if (since) {
    url += `&$filter=receivedDateTime ge ${since.toISOString()}`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token.value}` },
  });
  if (!res.ok) return err(`Falha ao buscar e-mails do Outlook: HTTP ${res.status}`);

  const data = (await res.json()) as { value: GraphMessage[] };
  const messages = data.value.map(mapGraphMessage);
  return ok(messages);
}

interface GraphMessage {
  id: string;
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime: string;
  hasAttachments: boolean;
  body?: { content?: string };
  bodyPreview?: string;
  internetMessageId?: string;
  internetMessageHeaders?: { name: string; value: string }[];
}

function headerValue(msg: GraphMessage, name: string): string | undefined {
  return msg.internetMessageHeaders?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase(),
  )?.value;
}

function mapGraphMessage(msg: GraphMessage): InboundMessage {
  return {
    providerMsgId: msg.id,
    internetMessageId: msg.internetMessageId ?? `outlook-${msg.id}`,
    inReplyTo: headerValue(msg, 'In-Reply-To'),
    references: headerValue(msg, 'References'),
    fromName: msg.from?.emailAddress?.name ?? '',
    fromAddress: msg.from?.emailAddress?.address ?? '',
    subject: msg.subject ?? '(sem assunto)',
    body: msg.body?.content ?? msg.bodyPreview ?? '',
    receivedAt: new Date(msg.receivedDateTime),
    hasAttachments: msg.hasAttachments,
  };
}

export function outlookConfigured(): boolean {
  return config.microsoft.configured();
}
