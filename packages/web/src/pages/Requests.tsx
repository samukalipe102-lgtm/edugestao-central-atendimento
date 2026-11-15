import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useApiData } from '../hooks';
import { StatusBadge } from '../components/StatusBadge';

interface RequestRow {
  id: string;
  protocol: string | null;
  senderName: string;
  senderEmail: string;
  subject: string;
  status: string;
  lastActivityAt: string;
  _count: { messages: number };
}

const STATUSES = [
  '',
  'NOVA',
  'PENDENTE',
  'EM_ATENDIMENTO',
  'AGUARDANDO_CORRECAO',
  'AGUARDANDO_RESPOSTA',
  'RESPONDIDA',
  'ARQUIVADA',
];

export function RequestsPage() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');

  const { data, loading, error } = useApiData<{ total: number; items: RequestRow[] }>(
    () =>
      api.get(
        `/requests?status=${status}&q=${encodeURIComponent(q)}&sort=${sort}`,
      ),
    [status, q, sort],
  );

  return (
    <>
      <h1 className="page-title">Solicitações</h1>

      <div className="panel">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            placeholder="Buscar por nome, e-mail, assunto ou protocolo"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: '1 1 240px' }}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ flex: '0 0 200px' }}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === '' ? 'Todos os status' : s}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ flex: '0 0 160px' }}>
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
          </select>
        </div>
      </div>

      {error && <p className="msg-error">{error}</p>}

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Remetente</th>
                <th>Assunto</th>
                <th>Msgs</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((r) => (
                <tr key={r.id}>
                  <td>{r.protocol ?? '—'}</td>
                  <td>
                    {r.senderName}
                    <div className="l" style={{ fontSize: '0.78rem' }}>
                      {r.senderEmail}
                    </div>
                  </td>
                  <td>
                    <Link to={`/solicitacoes/${r.id}`}>{r.subject}</Link>
                  </td>
                  <td>{r._count.messages}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
              {!loading && data?.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="l">
                    Nenhuma solicitação. Elas nascem automaticamente dos e-mails
                    recebidos e validados — não há criação manual.
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
