import { prisma } from '../db.js';
import { QUEUE_STATE } from '@edugestao/shared';
import { gmailSend } from '../integrations/gmail.js';
import { getSignature } from './settings.js';
import { audit } from './audit.js';

const MAX_ATTEMPTS = 3;

/**
 * Processa um lote da fila de envio. Só envia itens APROVADOS pelo admin.
 * Respeita o limite por lote. Um item só vira ACEITA_API quando o Gmail
 * devolve um Message-ID real; caso contrário, conta tentativa e pode ir a FALHA.
 *
 * Retorna quantos foram aceitos pela API e quantos falharam neste lote.
 */
export async function processQueueBatch(
  batchSize: number,
): Promise<{ accepted: number; failed: number; skipped: number }> {
  const items = await prisma.outboundQueue.findMany({
    where: { state: { in: [QUEUE_STATE.APROVADA, QUEUE_STATE.NA_FILA] } },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });

  let accepted = 0;
  let failed = 0;
  let skipped = 0;
  const signature = await getSignature();

  for (const item of items) {
    // Reconfirma a aprovação no momento do envio (não enviar sem autorização).
    if (!item.approvedBy) {
      skipped++;
      continue;
    }

    await prisma.outboundQueue.update({
      where: { id: item.id },
      data: { state: QUEUE_STATE.ENVIANDO, lastAttempt: new Date() },
    });

    // Vincula ao protocolo: busca o último Message-ID OUTBOUND/INBOUND da conversa.
    let inReplyTo: string | undefined;
    let references: string | undefined;
    if (item.requestId) {
      const lastMsg = await prisma.message.findFirst({
        where: { requestId: item.requestId, messageId: { not: null } },
        orderBy: { createdAt: 'desc' },
      });
      if (lastMsg?.messageId) {
        inReplyTo = lastMsg.messageId;
        references = [lastMsg.references, lastMsg.messageId].filter(Boolean).join(' ');
      }
    }

    const result = await gmailSend({
      to: item.toAddress,
      subject: item.subject,
      body: `${item.body}\n\n${signature}`,
      fromAddress: 'secretariaedugestao@gmail.com',
      fromName: 'Secretaria Escolar',
      inReplyTo,
      references,
    });

    if (result.ok) {
      await prisma.$transaction([
        prisma.outboundQueue.update({
          where: { id: item.id },
          data: {
            state: QUEUE_STATE.ACEITA_API,
            sentMessageId: result.value.messageId,
            lastError: null,
          },
        }),
        ...(item.requestId
          ? [
              prisma.message.create({
                data: {
                  requestId: item.requestId,
                  direction: 'OUTBOUND',
                  provider: 'GMAIL',
                  kind: item.kind,
                  fromAddress: 'secretariaedugestao@gmail.com',
                  toAddress: item.toAddress,
                  subject: item.subject,
                  body: item.body,
                  messageId: result.value.messageId,
                  providerMsgId: result.value.providerMsgId,
                  inReplyTo: inReplyTo ?? null,
                  references: references ?? null,
                  sentAt: new Date(),
                },
              }),
            ]
          : []),
      ]);
      await audit({
        action: 'EMAIL_SENT',
        entityType: 'OutboundQueue',
        entityId: item.id,
        metadata: { to: item.toAddress, messageId: result.value.messageId },
      });
      accepted++;
    } else {
      const attempts = item.attempts + 1;
      await prisma.outboundQueue.update({
        where: { id: item.id },
        data: {
          attempts,
          lastError: result.error,
          // Esgotou tentativas → FALHA; senão volta à fila para retry.
          state: attempts >= MAX_ATTEMPTS ? QUEUE_STATE.FALHA : QUEUE_STATE.NA_FILA,
        },
      });
      await audit({
        action: 'EMAIL_SEND_FAILED',
        entityType: 'OutboundQueue',
        entityId: item.id,
        metadata: { to: item.toAddress, error: result.error, attempts },
      });
      failed++;
    }
  }

  return { accepted, failed, skipped };
}

/** Conta falhas recentes para decidir pausa automática por erros repetidos. */
export async function recentFailureCount(): Promise<number> {
  return prisma.outboundQueue.count({ where: { state: QUEUE_STATE.FALHA } });
}
