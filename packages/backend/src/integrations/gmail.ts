import { google } from 'googleapis';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { decryptToken, encryptToken } from '../security/tokenVault.js';
import { err, ok, type Result } from '@edugestao/shared';

/**
 * Integração real com a conta de ENVIO (Gmail: secretariaedugestao@gmail.com).
 * Usa Gmail API + OAuth 2.0. Tokens guardados cifrados; nunca senhas.
 */

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

function oauthClient() {
  return new google.auth.OAuth2(
    config.gmail.clientId,
    config.gmail.clientSecret,
    config.gmail.redirectUri,
  );
}

/** URL para o admin autorizar o acesso à conta Gmail. */
export function gmailAuthUrl(): string {
  return oauthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
  });
}

/** Troca o código de autorização por tokens e persiste a conta de envio. */
export async function gmailHandleCallback(code: string): Promise<Result<string>> {
  try {
    const client = oauthClient();
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token) return err('Google não retornou access_token.');

    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const me = await oauth2.userinfo.get();
    const email = me.data.email ?? 'desconhecido';

    await prisma.mailAccount.upsert({
      where: { provider: 'GMAIL' },
      create: {
        provider: 'GMAIL',
        emailAddress: email,
        purpose: 'ENVIO',
        accessToken: tokens.access_token ? encryptToken(tokens.access_token) : null,
        refreshToken: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scope: GMAIL_SCOPES.join(' '),
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
    return err(`Falha ao concluir OAuth do Gmail: ${(e as Error).message}`);
  }
}

async function authedClient(): Promise<Result<ReturnType<typeof oauthClient>>> {
  const account = await prisma.mailAccount.findUnique({ where: { provider: 'GMAIL' } });
  if (!account || !account.connected || !account.refreshToken) {
    return err('Conta Gmail não conectada.');
  }
  const client = oauthClient();
  client.setCredentials({
    refresh_token: decryptToken(account.refreshToken),
    access_token: account.accessToken ? decryptToken(account.accessToken) : undefined,
    expiry_date: account.tokenExpiry?.getTime(),
  });
  return ok(client);
}

/** Testa a conexão realmente (consulta o perfil Gmail). */
export async function gmailTestConnection(): Promise<Result<{ email: string }>> {
  const c = await authedClient();
  if (!c.ok) return c;
  try {
    const gmail = google.gmail({ version: 'v1', auth: c.value });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    return ok({ email: profile.data.emailAddress ?? 'desconhecido' });
  } catch (e) {
    await prisma.mailAccount.update({
      where: { provider: 'GMAIL' },
      data: { lastError: (e as Error).message },
    });
    return err(`Teste de conexão Gmail falhou: ${(e as Error).message}`);
  }
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  body: string; // texto/HTML simples
  inReplyTo?: string; // Message-ID ao qual respondemos
  references?: string;
  fromName?: string;
  fromAddress: string;
}

/** Monta uma mensagem RFC 2822 em base64url (formato exigido pela Gmail API). */
function buildRawMessage(email: OutgoingEmail): string {
  const from = email.fromName
    ? `${email.fromName} <${email.fromAddress}>`
    : email.fromAddress;
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
 * Envia um e-mail real pelo Gmail. Só retorna ok quando a API devolve um id;
 * recupera o Message-ID real para permitir vinculação de respostas.
 * Aceitação pela API NÃO é confirmação de entrega ao destinatário.
 */
export async function gmailSend(
  email: OutgoingEmail,
): Promise<Result<{ messageId: string; providerMsgId: string }>> {
  const c = await authedClient();
  if (!c.ok) return c;
  try {
    const gmail = google.gmail({ version: 'v1', auth: c.value });
    const sent = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: buildRawMessage(email) },
    });
    const providerMsgId = sent.data.id;
    if (!providerMsgId) return err('Gmail aceitou mas não retornou id da mensagem.');

    // Recupera o Message-ID real do cabeçalho, para vincular respostas depois.
    const meta = await gmail.users.messages.get({
      userId: 'me',
      id: providerMsgId,
      format: 'metadata',
      metadataHeaders: ['Message-ID'],
    });
    const messageId =
      meta.data.payload?.headers?.find((h) => h.name?.toLowerCase() === 'message-id')
        ?.value ?? `gmail-${providerMsgId}`;

    return ok({ messageId, providerMsgId });
  } catch (e) {
    return err(`Falha no envio pelo Gmail: ${(e as Error).message}`);
  }
}

export function gmailConfigured(): boolean {
  return config.gmail.configured();
}
