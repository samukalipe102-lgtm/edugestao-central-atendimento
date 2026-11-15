import { prisma } from '../db.js';
import { MATCH_CONFIDENCE } from '@edugestao/shared';
import type { InboundMessage } from '../integrations/outlook.js';
import { matchInboundToRequest } from './matching.js';
import { changeStatus } from './requests.js';
import { audit } from './audit.js';

export interface IngestOutcome {
  action: 'LINKED' | 'HUMAN_REVIEW' | 'DUPLICATE';
  requestId?: string;
  reason: string;
}

/**
 * Processa uma mensagem recebida no Outlook:
 *  - evita duplicatas (mesmo internetMessageId já registrado);
 *  - vincula a um protocolo existente quando o vínculo é confiável;
 *  - caso contrário, registra para conferência humana (sem criar solicitação).
 *
 * NUNCA cria uma solicitação automaticamente a partir de uma mensagem solta.
 */
export async function ingestInbound(msg: InboundMessage): Promise<IngestOutcome> {
  // Anti-duplicidade.
  const existing = await prisma.message.findUnique({
    where: { messageId: msg.internetMessageId },
  });
  if (existing) {
    return { action: 'DUPLICATE', reason: 'Mensagem já registrada.' };
  }

  const match = await matchInboundToRequest(msg);

  if (match.requestId && match.confidence !== MATCH_CONFIDENCE.NENHUMA) {
    await prisma.message.create({
      data: {
        requestId: match.requestId,
        direction: 'INBOUND',
        provider: 'OUTLOOK',
        fromAddress: msg.fromAddress,
        toAddress: 'admsedugestao@outlook.com',
        subject: msg.subject,
        body: msg.body,
        messageId: msg.internetMessageId,
        inReplyTo: msg.inReplyTo ?? null,
        references: msg.references ?? null,
        providerMsgId: msg.providerMsgId,
        receivedAt: msg.receivedAt,
      },
    });
    // Resposta recebida → o atendimento volta a exigir ação do admin.
    await changeStatus(match.requestId, 'EM_ATENDIMENTO', 'SISTEMA', match.reason).catch(
      () => undefined,
    );
    await audit({
      action: 'INBOUND_LINKED',
      entityType: 'Request',
      entityId: match.requestId,
      metadata: { confidence: match.confidence, from: msg.fromAddress },
    });
    return { action: 'LINKED', requestId: match.requestId, reason: match.reason };
  }

  // Sem vínculo seguro → conferência humana. Guardamos o indício para o admin ver.
  await audit({
    action: 'INBOUND_HUMAN_REVIEW',
    entityType: 'Message',
    entityId: msg.internetMessageId,
    metadata: {
      from: msg.fromAddress,
      subject: msg.subject,
      confidence: match.confidence,
      reason: match.reason,
    },
  });
  return { action: 'HUMAN_REVIEW', reason: match.reason };
}
