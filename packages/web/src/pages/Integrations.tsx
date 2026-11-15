import { useState } from 'react';
import { api } from '../api';
import { useApiData } from '../hooks';

interface Account {
  provider: string;
  emailAddress: string;
  purpose: string;
  connected: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
}
interface Side {
  role: string; // gmail-send | gmail-recv
  expected: string;
  account: Account | null;
}
interface Status {
  configured: boolean;
  envio: Side;
  recebimento: Side;
}

export function IntegrationsPage() {
  const { data, reload, error } = useApiData<Status>(() => api.get('/integrations/status'));
  const [feedback, setFeedback] = useState<string | null>(null);

  async function connect(role: string) {
    setFeedback(null);
    try {
      const res = await api.get<{ url: string }>(`/integrations/${role}/connect`);
      window.open(res.url, '_blank', 'width=520,height=640');
      setFeedback('Autorize na janela aberta e depois clique em "Testar conexão".');
    } catch (e) {
      setFeedback((e as Error).message);
    }
  }

  async function test(role: string) {
    setFeedback(null);
    try {
      const res = await api.post<{ email: string }>(`/integrations/${role}/test`);
      setFeedback(`Conexão OK: ${res.email}`);
      reload();
    } catch (e) {
      setFeedback(`Falha no teste: ${(e as Error).message}`);
    }
  }

  function card(title: string, purpose: string, side: Side | undefined, configured: boolean) {
    if (!side) return null;
    return (
      <div className="panel">
        <h2>{title}</h2>
        <p className="l">{purpose}</p>
        <p className="l">Conta esperada: {side.expected}</p>
        {!configured && (
          <p className="msg-error">
            Credenciais do Google não configuradas no servidor (.env). Veja docs/.
          </p>
        )}
        <p>
          <span className={`dot ${side.account?.connected ? 'on' : 'off'}`} />
          {side.account?.connected
            ? `Conectada: ${side.account.emailAddress}`
            : 'Não conectada'}
        </p>
        {side.account?.lastError && (
          <p className="msg-error">Último erro: {side.account.lastError}</p>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button className="ghost" disabled={!configured} onClick={() => connect(side.role)}>
            Conectar
          </button>
          <button className="ghost" onClick={() => test(side.role)}>
            Testar conexão
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 className="page-title">Integrações</h1>
      <div className="panel">
        <p className="l">
          Duas contas Gmail (ambas gratuitas, um único app no Google Cloud):
          uma envia as comunicações oficiais, a outra recebe as respostas.
        </p>
      </div>
      {error && <p className="msg-error">{error}</p>}
      {feedback && <p className="msg-ok">{feedback}</p>}
      {card(
        'Gmail — envio',
        'Conta oficial de envio. Sai por aqui toda comunicação institucional da Secretaria.',
        data?.envio,
        data?.configured ?? false,
      )}
      {card(
        'Gmail — recebimento',
        'Conta oficial de recebimento. Recebe as respostas e documentos dos destinatários.',
        data?.recebimento,
        data?.configured ?? false,
      )}
    </>
  );
}
