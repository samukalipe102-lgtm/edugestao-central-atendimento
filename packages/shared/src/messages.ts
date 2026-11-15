/** Direção de uma mensagem dentro de um atendimento. */
export const MESSAGE_DIRECTION = {
  /** Recebida no Outlook (resposta/documento do destinatário). */
  INBOUND: 'INBOUND',
  /** Enviada pelo Gmail (comunicação oficial da Secretaria). */
  OUTBOUND: 'OUTBOUND',
} as const;

export type MessageDirection = (typeof MESSAGE_DIRECTION)[keyof typeof MESSAGE_DIRECTION];

/** Provedor/conta de e-mail de origem/destino de uma mensagem. */
export const MAIL_PROVIDER = {
  /** Conta Gmail de envio (secretariaedugestao@gmail.com). */
  GMAIL_SEND: 'GMAIL_SEND',
  /** Conta Gmail de recebimento (admsedugestao@gmail.com). */
  GMAIL_RECV: 'GMAIL_RECV',
} as const;

export type MailProvider = (typeof MAIL_PROVIDER)[keyof typeof MAIL_PROVIDER];

/** Natureza de uma comunicação oficial enviada pela Secretaria. */
export const COMMUNICATION_KIND = {
  CORRECAO: 'CORRECAO',
  DOCUMENTO_FALTANTE: 'DOCUMENTO_FALTANTE',
  INCONSISTENCIA: 'INCONSISTENCIA',
  AGRADECIMENTO: 'AGRADECIMENTO',
  CONFIRMACAO_RECEBIMENTO: 'CONFIRMACAO_RECEBIMENTO',
  ATUALIZACAO_PROTOCOLO: 'ATUALIZACAO_PROTOCOLO',
  ORIENTACAO: 'ORIENTACAO',
  COMUNICADO: 'COMUNICADO',
  CONCLUSAO: 'CONCLUSAO',
  LEMBRETE: 'LEMBRETE',
  RESPOSTA_MANUAL: 'RESPOSTA_MANUAL',
} as const;

export type CommunicationKind = (typeof COMMUNICATION_KIND)[keyof typeof COMMUNICATION_KIND];

/**
 * Estado de um item na fila de envio.
 * ACEITA_API ≠ ENTREGUE: a aceitação pela API não confirma entrega ao destinatário.
 */
export const QUEUE_STATE = {
  RASCUNHO: 'RASCUNHO',
  AGUARDANDO_APROVACAO: 'AGUARDANDO_APROVACAO',
  APROVADA: 'APROVADA',
  NA_FILA: 'NA_FILA',
  ENVIANDO: 'ENVIANDO',
  ACEITA_API: 'ACEITA_API',
  FALHA: 'FALHA',
  CANCELADA: 'CANCELADA',
} as const;

export type QueueState = (typeof QUEUE_STATE)[keyof typeof QUEUE_STATE];
