import 'dotenv/config';
import { startBackgroundWorker, stopBackgroundWorker } from '@edugestao/backend/services';

/**
 * Worker como PROCESSO SEPARADO (modo servidor).
 * Reaproveita exatamente o mesmo núcleo usado pelo app desktop — sem duplicar
 * lógica. Roda independente do painel.
 */

console.log('[worker] iniciado (processo separado).');
startBackgroundWorker();

process.on('SIGINT', () => {
  console.log('[worker] encerrando...');
  stopBackgroundWorker();
  setTimeout(() => process.exit(0), 500);
});

// Mantém o processo vivo.
setInterval(() => undefined, 1 << 30);
