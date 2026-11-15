import { useState } from 'react';
import { api } from '../api';
import { useApiData } from '../hooks';

interface QueueItem {
  id: string;
  kind: string;
  toAddress: string;
  subject: string;
  state: string;
  attempts: number;
  lastError: string | null;
  sentMessageId: string | null;
  createdAt: string;
}

const STATE_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  APROVADA: 'Aprovada',
  NA_FILA: 'Na fila',
  ENVIANDO: 'Enviando',
  ACEITA_API: 'Aceita pela API',
  FALHA: 'Falha',
  CANCELADA: 'Cancelada',
};

export function QueuePage() {
  const { data, reload, error } = useApiData<{ items: QueueItem[] }>(() => api.get('/queue'));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function act(path: string, body?: unknown) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.post<{ message?: string }>(path, body);
      if (res?.message) setMsg(res.message);
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="page-title">Fila de envio</h1>

      <div className="panel">
        <p className="l">
          Ponto de partida dos processos da Secretaria. O botão abaixo verifica a
          conexão com o Gmail e envia o primeiro lote dos pedidos <strong>aprovados</strong>.
          Aceitação pela API não é confirmação de entrega.
        </p>
        <button className="primary" disabled={busy} onClick={() => act('/queue/start')}>
          {busy ? 'Processando...' : 'Iniciar envio dos pedidos'}
        </button>
        {msg && <p className="msg-ok" style={{ marginTop: '0.75rem' }}>{msg}</p>}
      </div>

      {error && <p className="msg-error">{error}</p>}

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Destinatário</th>
                <th>Assunto</th>
                <th>Estado</th>
                <th>Tentativas</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.toAddress}</td>
                  <td>
                    {i.subject}
                    {i.lastError && <div className="msg-error">{i.lastError}</div>}
                  </td>
                  <td>{STATE_LABEL[i.state] ?? i.state}</td>
                  <td>{i.attempts}</td>
                  <td>
                    {(i.state === 'RASCUNHO' || i.state === 'AGUARDANDO_APROVACAO') && (
                      <button className="ghost" onClick={() => act(`/queue/${i.id}/approve`)}>
                        Aprovar
                      </button>
                    )}{' '}
                    {i.state !== 'ACEITA_API' && i.state !== 'CANCELADA' && (
                      <button className="ghost" onClick={() => act(`/queue/${i.id}/cancel`)}>
                        Cancelar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="l">
                    Fila vazia. Rascunhos criados nos atendimentos aparecem aqui.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
