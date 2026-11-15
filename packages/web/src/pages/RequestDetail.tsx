import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useApiData } from '../hooks';
import { StatusBadge } from '../components/StatusBadge';

interface MessageItem {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  provider: string;
  kind: string | null;
  fromAddress: string;
  toAddress: string;
  subject: string;
  body: string;
  createdAt: string;
  attachments: { id: string; filename: string }[];
}

interface RequestDetail {
  id: string;
  protocol: string | null;
  status: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  needsHumanReview: boolean;
  reviewReason: string | null;
  officialPerson: { name: string; kind: string } | null;
  messages: MessageItem[];
  statusLogs: { fromStatus: string | null; toStatus: string; actor: string; createdAt: string }[];
}

const KIND_OPTIONS = [
  { v: 'CORRECAO', l: 'Solicitação de correção' },
  { v: 'DOCUMENTO_FALTANTE', l: 'Documento faltante' },
  { v: 'AGRADECIMENTO', l: 'Agradecimento' },
  { v: 'RESPOSTA_MANUAL', l: 'Resposta manual' },
  { v: 'LEMBRETE', l: 'Lembrete' },
];

export function RequestDetailPage() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApiData<RequestDetail>(
    () => api.get(`/requests/${id}`),
    [id],
  );

  const [kind, setKind] = useState('CORRECAO');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  if (loading) return <p>Carregando atendimento...</p>;
  if (error) return <p className="msg-error">{error}</p>;
  if (!data) return null;

  async function createDraft() {
    setFeedback(null);
    try {
      await api.post('/queue/draft', {
        requestId: data!.id,
        kind,
        toAddress: data!.senderEmail,
        subject: subject || `[${data!.protocol ?? 'EduGestão'}] ${data!.subject}`,
        body,
      });
      setBody('');
      setFeedback('Rascunho criado na fila. Requer aprovação antes do envio.');
    } catch (e) {
      setFeedback((e as Error).message);
    }
  }

  async function setStatus(status: string) {
    try {
      await api.post(`/requests/${data!.id}/status`, { status });
      reload();
    } catch (e) {
      setFeedback((e as Error).message);
    }
  }

  return (
    <>
      <h1 className="page-title">
        {data.protocol ?? 'Sem protocolo'} <StatusBadge status={data.status} />
      </h1>

      {data.needsHumanReview && (
        <div className="panel" style={{ borderColor: 'var(--alerta)' }}>
          <strong className="msg-error">Conferência humana</strong>
          <p className="l">{data.reviewReason}</p>
        </div>
      )}

      <div className="panel">
        <h2>Dados</h2>
        <p>
          <strong>{data.senderName}</strong> &lt;{data.senderEmail}&gt;
        </p>
        <p>Assunto: {data.subject}</p>
        <p className="l">
          Vínculo com base oficial:{' '}
          {data.officialPerson
            ? `${data.officialPerson.name} (${data.officialPerson.kind})`
            : 'não localizado — conferência administrativa'}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          <button className="ghost" onClick={() => setStatus('EM_ATENDIMENTO')}>
            Em atendimento
          </button>
          <button className="ghost" onClick={() => setStatus('AGUARDANDO_CORRECAO')}>
            Aguardando correção
          </button>
          <button className="ghost" onClick={() => setStatus('RESPONDIDA')}>
            Marcar respondida
          </button>
          <button className="ghost" onClick={() => setStatus('ARQUIVADA')}>
            Arquivar
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>Histórico da conversa</h2>
        {data.messages.length === 0 && <p className="l">Sem mensagens registradas.</p>}
        {data.messages.map((m) => (
          <div
            key={m.id}
            style={{
              borderLeft: `3px solid ${m.direction === 'OUTBOUND' ? 'var(--azul)' : 'var(--ok)'}`,
              padding: '0.5rem 0.75rem',
              margin: '0.5rem 0',
              background: 'var(--fundo)',
              borderRadius: 6,
            }}
          >
            <div className="l" style={{ fontSize: '0.78rem' }}>
              {m.direction === 'OUTBOUND' ? '→ Enviada (Gmail)' : '← Recebida (Outlook)'} ·{' '}
              {new Date(m.createdAt).toLocaleString('pt-BR')}
            </div>
            <div style={{ fontWeight: 600 }}>{m.subject}</div>
            <div
              style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem' }}
              dangerouslySetInnerHTML={{ __html: sanitize(m.body) }}
            />
            {m.attachments.length > 0 && (
              <div className="l">Anexos: {m.attachments.map((a) => a.filename).join(', ')}</div>
            )}
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Preparar comunicação</h2>
        <p className="l">
          A mensagem é salva como rascunho na fila. O envio pelo Gmail só ocorre
          após sua aprovação explícita.
        </p>
        <label>Tipo</label>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {KIND_OPTIONS.map((o) => (
            <option key={o.v} value={o.v}>
              {o.l}
            </option>
          ))}
        </select>
        <label>Assunto (opcional)</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} />
        <label>Mensagem</label>
        <textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
        {feedback && <p className="msg-ok">{feedback}</p>}
        <button className="primary" style={{ marginTop: '0.75rem' }} disabled={!body} onClick={createDraft}>
          Salvar rascunho na fila
        </button>
      </div>
    </>
  );
}

/** Sanitização mínima: remove scripts/handlers de HTML recebido por e-mail. */
function sanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/ on\w+="[^"]*"/gi, '')
    .replace(/ on\w+='[^']*'/gi, '');
}
