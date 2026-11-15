import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { prisma } from '../db.js';
import { matchInboundToRequest } from '../services/matching.js';
import { generateProtocol } from '../services/protocol.js';
import { canTransition } from '@edugestao/shared';
import type { InboundMessage } from '../integrations/outlook.js';

/**
 * Testes da lógica mais crítica: vinculação de respostas e transições de status.
 * Usa um banco SQLite temporário real.
 */

function inbound(overrides: Partial<InboundMessage>): InboundMessage {
  return {
    providerMsgId: 'p1',
    internetMessageId: '<reply-1@mail>',
    fromName: 'Maria',
    fromAddress: 'maria@example.com',
    subject: 'Re: documentos',
    body: 'segue',
    receivedAt: new Date(),
    hasAttachments: false,
    ...overrides,
  };
}

beforeAll(() => {
  process.env.DATABASE_URL = 'file:./data/test.db';
  execSync('npx prisma migrate deploy', {
    cwd: new URL('../..', import.meta.url).pathname,
    stdio: 'ignore',
    env: { ...process.env },
  });
});

afterAll(async () => {
  await prisma.message.deleteMany();
  await prisma.request.deleteMany();
  await prisma.$disconnect();
});

describe('transições de status', () => {
  it('permite caminho válido e bloqueia inválido', () => {
    expect(canTransition('NOVA', 'EM_ATENDIMENTO')).toBe(true);
    expect(canTransition('NOVA', 'RESPONDIDA')).toBe(false); // não pode pular etapas
    expect(canTransition('ARQUIVADA', 'RESPONDIDA')).toBe(false);
  });
});

describe('vinculação de resposta ao protocolo', () => {
  it('vincula por In-Reply-To (confiança ALTA)', async () => {
    const protocol = await generateProtocol();
    const req = await prisma.request.create({
      data: {
        protocol,
        senderName: 'Maria',
        senderEmail: 'maria@example.com',
        subject: 'documentos',
        status: 'AGUARDANDO_RESPOSTA',
      },
    });
    await prisma.message.create({
      data: {
        requestId: req.id,
        direction: 'OUTBOUND',
        provider: 'GMAIL',
        fromAddress: 'secretariaedugestao@gmail.com',
        toAddress: 'maria@example.com',
        subject: `[${protocol}] documentos`,
        body: 'envie os documentos',
        messageId: '<out-1@gmail>',
      },
    });

    const match = await matchInboundToRequest(inbound({ inReplyTo: '<out-1@gmail>' }));
    expect(match.confidence).toBe('ALTA');
    expect(match.requestId).toBe(req.id);
  });

  it('não vincula quando não há indício seguro (conferência humana)', async () => {
    const match = await matchInboundToRequest(
      inbound({ subject: 'assunto solto', inReplyTo: undefined }),
    );
    expect(match.requestId).toBeNull();
    expect(match.confidence).toBe('NENHUMA');
  });
});
