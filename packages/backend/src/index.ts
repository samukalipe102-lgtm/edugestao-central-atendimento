import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { requestsRouter } from './routes/requests.js';
import { queueRouter } from './routes/queue.js';
import { integrationsRouter } from './routes/integrations.js';
import { dashboardRouter } from './routes/dashboard.js';
import { settingsRouter } from './routes/settings.js';
import { reportsRouter } from './routes/reports.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, ia: config.gemini.enabled() }));

  app.use('/api/auth', authRouter);
  app.use('/api/requests', requestsRouter);
  app.use('/api/queue', queueRouter);
  app.use('/api/integrations', integrationsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/reports', reportsRouter);

  return app;
}

// Só sobe o servidor quando executado diretamente (não em testes).
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[backend] API ouvindo em http://localhost:${config.port}`);
    console.log(`[backend] IA ${config.gemini.enabled() ? 'ligada' : 'desligada'}`);
  });
}
