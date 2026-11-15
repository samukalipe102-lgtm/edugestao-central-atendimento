import { prisma } from '../db.js';
import { MATCH_CONFIDENCE, type MatchConfidence } from '@edugestao/shared';
import type { InboundMessage } from '../integrations/outlook.js';

export interface MatchResult {
  requestId: string | null;
  confidence: MatchConfidence;
  reason: string;
}

/** Extrai números de protocolo do assunto (formato EDU-YYYY-NNNNNN). */
function extractProtocol(subject: string): string | null {
  const m = subject.match(/EDU-\d{4}-\d{6}/i);
  return m ? m[0].toUpperCase() : null;
}

/** Quebra o cabeçalho References numa lista de Message-IDs. */
function parseReferences(refs?: string): string[] {
  if (!refs) return [];
  return refs.match(/<[^>]+>/g) ?? refs.split(/\s+/).filter(Boolean);
}

/**
 * Vincula uma mensagem recebida ao protocolo original.
 *
 * Ordem (nunca só por assunto):
 *  1. In-Reply-To / References → Message-ID de uma mensagem OUTBOUND  (ALTA)
 *  2. Protocolo no assunto + remetente conhecido naquele atendimento  (MEDIA)
 *  3. Protocolo no assunto, mas remetente diferente                   (BAIXA → humano)
 *  4. Nada disso                                                      (NENHUMA → humano)
 */
export async function matchInboundToRequest(msg: InboundMessage): Promise<MatchResult> {
  // 1. Vínculo por cabeçalhos (confiável).
  const candidateIds = [
    ...(msg.inReplyTo ? [msg.inReplyTo] : []),
    ...parseReferences(msg.references),
  ];
  for (const mid of candidateIds) {
    const prior = await prisma.message.findFirst({
      where: { messageId: mid, direction: 'OUTBOUND' },
      select: { requestId: true },
    });
    if (prior) {
      return {
        requestId: prior.requestId,
        confidence: MATCH_CONFIDENCE.ALTA,
        reason: `Cabeçalho vincula ao Message-ID ${mid}.`,
      };
    }
  }

  // 2/3. Protocolo no assunto.
  const protocol = extractProtocol(msg.subject);
  if (protocol) {
    const req = await prisma.request.findUnique({ where: { protocol } });
    if (req) {
      const sameSender =
        req.senderEmail.toLowerCase() === msg.fromAddress.toLowerCase();
      return sameSender
        ? {
            requestId: req.id,
            confidence: MATCH_CONFIDENCE.MEDIA,
            reason: `Protocolo ${protocol} no assunto e remetente confere.`,
          }
        : {
            requestId: null,
            confidence: MATCH_CONFIDENCE.BAIXA,
            reason: `Protocolo ${protocol} no assunto, mas remetente diferente (${msg.fromAddress}). Conferência humana.`,
          };
    }
  }

  // 4. Sem indício seguro → não criar solicitação automaticamente.
  return {
    requestId: null,
    confidence: MATCH_CONFIDENCE.NENHUMA,
    reason: 'Não foi possível vincular com segurança. Encaminhado para conferência humana.',
  };
}
