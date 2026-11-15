// Superfície pública dos serviços reutilizados pelo worker.
export { prisma } from '../db.js';
export { config } from '../config.js';
export { ingestInbound } from './ingest.js';
export { processQueueBatch, recentFailureCount } from './queue.js';
export { getAutomation } from './settings.js';
export { outlookFetchMessages } from '../integrations/outlook.js';
