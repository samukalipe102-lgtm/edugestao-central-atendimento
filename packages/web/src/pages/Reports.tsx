import { api } from '../api';
import { useApiData } from '../hooks';

interface Summary {
  received: number;
  responded: number;
  pending: number;
  awaitingCorrection: number;
  correctionsSent: number;
  inboundReceived: number;
  thanksSent: number;
  avgResolutionHours: number;
}

const ROWS: { key: keyof Summary; label: string; suffix?: string }[] = [
  { key: 'received', label: 'Solicitações recebidas' },
  { key: 'responded', label: 'Solicitações respondidas' },
  { key: 'pending', label: 'Pendentes' },
  { key: 'awaitingCorrection', label: 'Aguardando correção' },
  { key: 'correctionsSent', label: 'Correções enviadas' },
  { key: 'inboundReceived', label: 'Respostas recebidas' },
  { key: 'thanksSent', label: 'Agradecimentos enviados' },
  { key: 'avgResolutionHours', label: 'Tempo médio de atendimento', suffix: ' h' },
];

export function ReportsPage() {
  const { data, loading, error } = useApiData<Summary>(() => api.get('/reports/summary'));

  function exportCsv() {
    if (!data) return;
    const lines = ROWS.map((r) => `${r.label};${data[r.key]}${r.suffix ?? ''}`);
    const blob = new Blob([`Indicador;Valor\n${lines.join('\n')}`], {
      type: 'text/csv;charset=utf-8',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-edugestao-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  if (loading) return <p>Carregando relatório...</p>;
  if (error) return <p className="msg-error">{error}</p>;
  if (!data) return null;

  return (
    <>
      <h1 className="page-title">Relatórios</h1>
      <div className="panel">
        <div className="table-wrap">
          <table>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td style={{ fontWeight: 600 }}>
                    {data[r.key]}
                    {r.suffix ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
          <button className="ghost" onClick={exportCsv}>
            Exportar CSV (Excel)
          </button>
          <button className="ghost" onClick={() => window.print()}>
            Exportar PDF (imprimir)
          </button>
        </div>
      </div>
    </>
  );
}
