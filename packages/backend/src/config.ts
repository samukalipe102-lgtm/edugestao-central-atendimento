import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL', 'file:./data/edugestao.db'),
  jwtSecret: required('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY ?? '',

  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID ?? '',
    clientSecret: process.env.GMAIL_CLIENT_SECRET ?? '',
    redirectUri:
      process.env.GMAIL_REDIRECT_URI ??
      'http://localhost:4000/api/integrations/gmail/callback',
    configured(): boolean {
      return Boolean(this.clientId && this.clientSecret);
    },
  },

  microsoft: {
    clientId: process.env.MS_CLIENT_ID ?? '',
    clientSecret: process.env.MS_CLIENT_SECRET ?? '',
    tenant: process.env.MS_TENANT ?? 'consumers',
    redirectUri:
      process.env.MS_REDIRECT_URI ??
      'http://localhost:4000/api/integrations/outlook/callback',
    configured(): boolean {
      return Boolean(this.clientId && this.clientSecret);
    },
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    enabled(): boolean {
      return Boolean(this.apiKey);
    },
  },
} as const;
