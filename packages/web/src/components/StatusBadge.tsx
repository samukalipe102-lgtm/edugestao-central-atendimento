const LABELS: Record<string, string> = {
  NOVA: 'Nova',
  PENDENTE: 'Pendente',
  EM_ATENDIMENTO: 'Em atendimento',
  AGUARDANDO_CORRECAO: 'Aguardando correção',
  AGUARDANDO_RESPOSTA: 'Aguardando resposta',
  RESPONDIDA: 'Respondida',
  ARQUIVADA: 'Arquivada',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{LABELS[status] ?? status}</span>;
}
