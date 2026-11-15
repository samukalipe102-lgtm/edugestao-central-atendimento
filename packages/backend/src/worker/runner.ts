import { prisma } from '../db.js';
import { ingestInbound } from '../services/ingest.js';
import { processQueueBatch, recentFailureCount } from '../services/queue.js';
import { getAutomation } from '../services/settings.js';
import { gmailFetchMessages } from '../integrations/gmail.js';

/**
 * Núcleo do worker de segundo plano. Reutilizado:
 *   - pelo pacote worker (processo separado, modo servidor);
 *   - pelo backend (no mesmo processo, modo app desktop).
 *
 * Dois laços independentes, em intervalos configuráveis pelo admin.
 * Pausa automática do envio em falhas repetidas (circuit breaker).
 */

let stopping = false;
let running = false;

function withinWorkingHours(start: number, end: number): boolean {
  const h = new Date().getHours();
  return start <= end ? h >= start && h <= end : h >= start || h <= end;
}

async function pollInbox(): Promise<void> {
  const account = await prisma.mailAccount.findUnique({ where: { provider: 'GMAIL_RECV' } });
  if (!account?.connected) return;

  const result = await gmailFetchMessages(account.lastSyncAt);
  if (!result.ok) {
    await prisma.mailAccount.update({
      where: { provider: 'GMAIL_RECV' },
      data: { lastError: result.error },
    });
    console.warn(`[worker] poll recebimento falhou: ${result.error}`);
    return;
  }

  let linked = 0;
  let review = 0;
  for (const msg of [...result.value].reverse()) {
    const outcome = await ingestInbound(msg);
    if (outcome.action === 'LINKED') linked++;
    else if (outcome.action === 'HUMAN_REVIEW') review++;
  }

  await prisma.mailAccount.update({
    where: { provider: 'GMAIL_RECV' },
    data: { lastSyncAt: new Date(), lastError: null },
  });
  if (linked || review) {
    console.log(`[worker] Recebimento: ${linked} vinculada(s), ${review} p/ conferência.`);
  }
}

async function drainQueue(): Promise<void> {
  const automation = await getAutomation();
  if (!withinWorkingHours(automation.workStartHour, automation.workEndHour)) return;

  const failures = await recentFailureCount();
  if (failures >= automation.pauseAfterFailures) {
    console.warn(
      `[worker] Envio PAUSADO: ${failures} falha(s) acumulada(s) (limite ${automation.pauseAfterFailures}).`,
    );
    return;
  }

  const result = await processQueueBatch(automation.queueBatchSize);
  if (result.accepted || result.failed) {
    console.log(`[worker] Fila: ${result.accepted} aceita(s) pela API, ${result.failed} falha(s).`);
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

/** Inicia os laços de segundo plano. Idempotente (não duplica se já rodando). */
export function startBackgroundWorker(): void {
  if (running) return;
  running = true;
  stopping = false;

  void getAutomation().then((automation) => {
    console.log(
      `[worker] poll recebimento a cada ${automation.pollIntervalMinutes} min; fila a cada ${automation.queueIntervalMinutes} min.`,
    );
    void loop(pollInbox, automation.pollIntervalMinutes * 60_000, 'pollInbox');
    void loop(drainQueue, automation.queueIntervalMinutes * 60_000, 'drainQueue');
  });
}

/** Sinaliza parada dos laços (encerramento gracioso). */
export function stopBackgroundWorker(): void {
  stopping = true;
  running = false;
}
