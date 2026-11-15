import { Link } from 'react-router-dom';
import { api } from '../api';
import { useApiData } from '../hooks';
import { StatusBadge } from '../components/StatusBadge';

interface DashboardData {
  totalEmails: number;
  byStatus: Record<string, number>;
  recentRequests: {
    id: string;
    protocol: string | null;
    senderName: string;
    subject: string;
    status: string;
    lastActivityAt: string;
  }[];
  recentActivity: { action: string; entityType: string; createdAt: string }[];
  integrations: { provider: string; connected: boolean; lastError: string | null }[];
  volumeByDay: Record<string, number>;
}

const CARDS: { key: string; label: string }[] = [
  { key: 'PENDENTE', label: 'Pendentes' },
  { key: 'EM_ATENDIMENTO', label: 'Em atendimento' },
  { key: 'AGUARDANDO_CORRECAO', label: 'Aguardando correção' },
  { key: 'AGUARDANDO_RESPOSTA', label: 'Aguardando resposta' },
  { key: 'RESPONDIDA', label: 'Respondidas' },
  { key: 'ARQUIVADA', label: 'Arquivadas' },
];

export function DashboardPage() {
  const { data, loading, error } = useApiData<DashboardData>(() => api.get('/dashboard'));

  if (loading) return <p>Carregando painel...</p>;
  if (error) return <p className="msg-error">{error}</p>;
  if (!data) return null;

  const maxVol = Math.max(1, ...Object.values(data.volumeByDay));

  return (
    <>
      <h1 className="page-title">Painel</h1>

      <div className="cards">
        <div className="card">
          <div className="n">{data.totalEmails}</div>
          <div className="l">E-mails registrados</div>
        </div>
        {CARDS.map((c) => (
          <div className="card" key={c.key}>
            <div className="n">{data.byStatus[c.key] ?? 0}</div>
            <div className="l">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Volume de solicitações (14 dias)</h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
          {Object.entries(data.volumeByDay).length === 0 && (
            <p className="l">Sem solicitações no período.</p>
          )}
          {Object.entries(data.volumeByDay).map(([day, n]) => (
            <div key={day} style={{ flex: 1, textAlign: 'center' }} title={`${day}: ${n}`}>
              <div
                style={{
                  background: 'var(--azul-claro)',
                  height: `${(n / maxVol) * 100}px`,
                  borderRadius: '4px 4px 0 0',
                }}
              />
              <div style={{ fontSize: '0.65rem', color: 'var(--texto-suave)' }}>
                {day.slice(8)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Situação das integrações</h2>
        {data.integrations.length === 0 && <p className="l">Nenhuma conta conectada.</p>}
        {data.integrations.map((i) => (
          <div key={i.provider} style={{ marginBottom: '0.4rem' }}>
            <span className={`dot ${i.connected ? 'on' : 'off'}`} />
            <strong>{i.provider}</strong> — {i.connected ? 'conectada' : 'desconectada'}
            {i.lastError && <span className="msg-error"> ({i.lastError})</span>}
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Últimos atendimentos</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Remetente</th>
                <th>Assunto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentRequests.map((r) => (
                <tr key={r.id}>
                  <td>{r.protocol ?? '—'}</td>
                  <td>{r.senderName}</td>
                  <td>
                    <Link to={`/solicitacoes/${r.id}`}>{r.subject}</Link>
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
              {data.recentRequests.length === 0 && (
                <tr>
                  <td colSpan={4} className="l">
                    Nenhum atendimento ainda. As solicitações entram pelos e-mails recebidos.
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
