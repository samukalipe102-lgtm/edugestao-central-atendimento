/**
 * Resultado explícito de operações que podem falhar (envio, sincronização,
 * vinculação). Evita marcar algo como concluído quando não foi — regra central
 * do sistema.
 */
export type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Confiança na vinculação de uma resposta recebida a um protocolo existente. */
export const MATCH_CONFIDENCE = {
  /** Message-ID / References batem: vínculo seguro. */
  ALTA: 'ALTA',
  /** Protocolo no assunto + remetente conhecido. */
  MEDIA: 'MEDIA',
  /** Apenas indícios fracos: encaminhar para conferência humana. */
  BAIXA: 'BAIXA',
  /** Nenhum indício: não criar solicitação automaticamente. */
  NENHUMA: 'NENHUMA',
} as const;

export type MatchConfidence = (typeof MATCH_CONFIDENCE)[keyof typeof MATCH_CONFIDENCE];
