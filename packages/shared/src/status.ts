/**
 * Status de atendimento de uma solicitação.
 * Ordem e nomes espelham exatamente a especificação da Central de Atendimento.
 */
export const REQUEST_STATUS = {
  NOVA: 'NOVA',
  PENDENTE: 'PENDENTE',
  EM_ATENDIMENTO: 'EM_ATENDIMENTO',
  AGUARDANDO_CORRECAO: 'AGUARDANDO_CORRECAO',
  AGUARDANDO_RESPOSTA: 'AGUARDANDO_RESPOSTA',
  RESPONDIDA: 'RESPONDIDA',
  ARQUIVADA: 'ARQUIVADA',
} as const;

export type RequestStatus = (typeof REQUEST_STATUS)[keyof typeof REQUEST_STATUS];

/** Rótulos em português para exibição na interface. */
export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  NOVA: 'Nova solicitação',
  PENDENTE: 'Pendente',
  EM_ATENDIMENTO: 'Em atendimento',
  AGUARDANDO_CORRECAO: 'Aguardando correção',
  AGUARDANDO_RESPOSTA: 'Aguardando resposta',
  RESPONDIDA: 'Respondida',
  ARQUIVADA: 'Arquivada',
};

/**
 * Transições de status permitidas. Impede que o fluxo pule etapas
 * ou feche protocolos indevidamente.
 */
export const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  NOVA: ['PENDENTE', 'EM_ATENDIMENTO', 'ARQUIVADA'],
  PENDENTE: ['EM_ATENDIMENTO', 'ARQUIVADA'],
  EM_ATENDIMENTO: ['AGUARDANDO_CORRECAO', 'AGUARDANDO_RESPOSTA', 'RESPONDIDA', 'ARQUIVADA'],
  AGUARDANDO_CORRECAO: ['EM_ATENDIMENTO', 'AGUARDANDO_RESPOSTA', 'RESPONDIDA', 'ARQUIVADA'],
  AGUARDANDO_RESPOSTA: ['EM_ATENDIMENTO', 'AGUARDANDO_CORRECAO', 'RESPONDIDA', 'ARQUIVADA'],
  RESPONDIDA: ['EM_ATENDIMENTO', 'ARQUIVADA'],
  ARQUIVADA: ['EM_ATENDIMENTO'],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
