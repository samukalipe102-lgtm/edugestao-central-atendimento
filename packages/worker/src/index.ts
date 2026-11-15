import 'dotenv/config';
import {
  prisma,
  ingestInbound,
  processQueueBatch,
  recentFailureCount,
  getAutomation,
  outlookFetchMessages,
} from '@edugestao/backend/services';

/**
 * Worker de segundo plano. Roda SEPARADO do painel e continua funcionando com
 * a página fechada — não depende de timer do navegador.
 *
 * Dois laços independentes, em intervalos configuráveis:
 *   - pollOutlook:  busca respostas no Outlook e as vincula aos protocolos.
 *   - drainQueue:   envia o próximo lote da fila do Gmail (só itens aprovados).
 *
 * Pausa automática do envio quando há falhas repetidas (circuit breaker).
 */

let stopping = false;

function withinWorkingHours(start: number, end: number): boolean {
  const h = new Date().getHours();
  return start <= end ? h >= start && h <= end : h >= start || h <= end;
}

async function pollOutlook(): Promise<void> {
  const account = await prisma.mailAccount.findUnique({ where: { provider: 'OUTLOOK' } });
  if (!account?.connected) return;

  const result = await outlookFetchMessages(account.lastSyncAt);
  if (!result.ok) {
    await prisma.mailAccount.update({
      where: { provider: 'OUTLOOK' },
      data: { lastError: result.error },
    });
    console.warn(`[worker] poll Outlook falhou: ${result.error}`);
    return;
  }

  let linked = 0;
  let review = 0;
  // Processa do mais antigo ao mais novo para manter a ordem cronológica.
  for (const msg of [...result.value].reverse()) {
    const outcome = await ingestInbound(msg);
    if (outcome.action === 'LINKED') linked++;
    else if (outcome.action === 'HUMAN_REVIEW') review++;
  }

  await prisma.mailAccount.update({
    where: { provider: 'OUTLOOK' },
    data: { lastSyncAt: new Date(), lastError: null },
  });
  if (linked || review) {
    console.log(`[worker] Outlook: ${linked} vinculada(s), ${review} p/ conferência.`);
  }
}

async function drainQueue(): Promise<void> {
  const automation = await getAutomation();

  if (!withinWorkingHours(automation.workStartHour, automation.workEndHour)) return;

  // Circuit breaker: pausa o envio se houver falhas repetidas acumuladas.
  const failures = await recentFailureCount();
  if (failures >= automation.pauseAfterFailures) {
    console.warn(
      `[worker] Envio PAUSADO: ${failures} falha(s) acumulada(s) (limite ${automation.pauseAfterFailures}). Resolva na fila.`,
    );
    return;
  }

  const result = await processQueueBatch(automation.queueBatchSize);
  if (result.accepted || result.failed) {
    console.log(
      `[worker] Fila: ${result.accepted} aceita(s) pela API, ${result.failed} falha(s).`,
    );
  }
}

async function loop(task: () => Promise<void>, intervalMs: number, name: string): Promise<void> {
  while (!stopping) {
    try {
      await task();
    } catch (e) {
      console.error(`[worker] erro em ${name}:`, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

async function main(): Promise<void> {
  const automation = await getAutomation();
  console.log('[worker] iniciado.');
  console.log(
    `[worker] poll Outlook a cada ${automation.pollIntervalMinutes} min; fila a cada ${automation.queueIntervalMinutes} min.`,
  );

  // Relê os intervalos a cada ciclo a partir das settings (permite ajuste sem reiniciar).
  await Promise.all([
    loop(pollOutlook, automation.pollIntervalMinutes * 60_000, 'pollOutlook'),
    loop(drainQueue, automation.queueIntervalMinutes * 60_000, 'drainQueue'),
  ]);
}

process.on('SIGINT', () => {
  stopping = true;
  console.log('[worker] encerrando...');
  setTimeout(() => process.exit(0), 500);
});

main().catch((e) => {
  console.error('[worker] falha fatal:', e);
  process.exit(1);
});
