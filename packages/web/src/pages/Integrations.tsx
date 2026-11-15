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
interface Status {
  gmail: { configured: boolean; account: Account | null };
  outlook: { configured: boolean; account: Account | null };
}

export function IntegrationsPage() {
  const { data, reload, error } = useApiData<Status>(() => api.get('/integrations/status'));
  const [feedback, setFeedback] = useState<string | null>(null);

  async function connect(provider: 'gmail' | 'outlook') {
    setFeedback(null);
    try {
      const res = await api.get<{ url: string }>(`/integrations/${provider}/connect`);
      window.open(res.url, '_blank', 'width=520,height=640');
      setFeedback('Autorize na janela aberta e depois clique em "Testar conexão".');
    } catch (e) {
      setFeedback((e as Error).message);
    }
  }

  async function test(provider: 'gmail' | 'outlook') {
    setFeedback(null);
    try {
      const res = await api.post<{ email: string }>(`/integrations/${provider}/test`);
      setFeedback(`Conexão OK: ${res.email}`);
      reload();
    } catch (e) {
      setFeedback(`Falha no teste: ${(e as Error).message}`);
    }
  }

  function card(
    title: string,
    provider: 'gmail' | 'outlook',
    purpose: string,
    info: { configured: boolean; account: Account | null } | undefined,
  ) {
    return (
      <div className="panel">
        <h2>{title}</h2>
        <p className="l">{purpose}</p>
        {!info?.configured && (
          <p className="msg-error">
            Credenciais não configuradas no servidor (.env). Veja docs/.
          </p>
        )}
        <p>
          <span className={`dot ${info?.account?.connected ? 'on' : 'off'}`} />
          {info?.account?.connected
            ? `Conectada: ${info.account.emailAddress}`
            : 'Não conectada'}
        </p>
        {info?.account?.lastError && (
          <p className="msg-error">Último erro: {info.account.lastError}</p>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button className="ghost" disabled={!info?.configured} onClick={() => connect(provider)}>
            Conectar
          </button>
          <button className="ghost" onClick={() => test(provider)}>
            Testar conexão
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 className="page-title">Integrações</h1>
      {error && <p className="msg-error">{error}</p>}
      {feedback && <p className="msg-ok">{feedback}</p>}
      {card(
        'Gmail — envio',
        'gmail',
        'Conta oficial de envio (secretariaedugestao@gmail.com). Sai por aqui toda comunicação institucional.',
        data?.gmail,
      )}
      {card(
        'Outlook — recebimento',
        'outlook',
        'Conta oficial de recebimento (admsedugestao@outlook.com). Recebe as respostas dos destinatários.',
        data?.outlook,
      )}
    </>
  );
}
