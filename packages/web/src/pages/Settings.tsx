import { useEffect, useState } from 'react';
import { api } from '../api';

interface Automation {
  pollIntervalMinutes: number;
  autoSyncEnabled: boolean;
  queueBatchSize: number;
  queueIntervalMinutes: number;
  pauseAfterFailures: number;
  workStartHour: number;
  workEndHour: number;
}

export function SettingsPage() {
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [signature, setSignature] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ automation: Automation; signature: string }>('/settings')
      .then((d) => {
        setAutomation(d.automation);
        setSignature(d.signature);
      })
      .catch((e) => setFeedback((e as Error).message));
  }, []);

  async function saveAutomation() {
    if (!automation) return;
    setFeedback(null);
    try {
      await api.put('/settings/automation', automation);
      setFeedback('Automação salva.');
    } catch (e) {
      setFeedback((e as Error).message);
    }
  }

  async function saveSignature() {
    setFeedback(null);
    try {
      await api.put('/settings/signature', { signature });
      setFeedback('Assinatura salva.');
    } catch (e) {
      setFeedback((e as Error).message);
    }
  }

  function field(key: keyof Automation, label: string, max = 120) {
    if (!automation) return null;
    return (
      <div>
        <label>{label}</label>
        <input
          type="number"
          min={1}
          max={max}
          value={automation[key] as number}
          onChange={(e) => setAutomation({ ...automation, [key]: Number(e.target.value) })}
        />
      </div>
    );
  }

  return (
    <>
      <h1 className="page-title">Configurações</h1>
      {feedback && <p className="msg-ok">{feedback}</p>}

      <div className="panel">
        <h2>Automação (worker em segundo plano)</h2>
        {automation && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '0.75rem',
            }}
          >
            {field('pollIntervalMinutes', 'Intervalo de verificação do Outlook (min)')}
            {field('queueBatchSize', 'Mensagens por lote', 50)}
            {field('queueIntervalMinutes', 'Intervalo entre lotes (min)')}
            {field('pauseAfterFailures', 'Pausar após N falhas', 100)}
            {field('workStartHour', 'Início do expediente (0-23)', 23)}
            {field('workEndHour', 'Fim do expediente (0-23)', 23)}
          </div>
        )}
        <button className="primary" style={{ marginTop: '1rem' }} onClick={saveAutomation}>
          Salvar automação
        </button>
      </div>

      <div className="panel">
        <h2>Assinatura institucional</h2>
        <p className="l">Aplicada a todas as comunicações enviadas pelo Gmail.</p>
        <textarea rows={6} value={signature} onChange={(e) => setSignature(e.target.value)} />
        <button className="primary" style={{ marginTop: '0.75rem' }} onClick={saveSignature}>
          Salvar assinatura
        </button>
      </div>
    </>
  );
}
