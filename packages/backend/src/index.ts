import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { requestsRouter } from './routes/requests.js';
import { queueRouter } from './routes/queue.js';
import { integrationsRouter } from './routes/integrations.js';
import { dashboardRouter } from './routes/dashboard.js';
import { settingsRouter } from './routes/settings.js';
import { reportsRouter } from './routes/reports.js';

/**
 * Monta a aplicação Express.
 * @param webDir  Caminho opcional para o build do painel (packages/web/dist).
 *                Quando informado, o painel é servido pelo próprio backend —
 *                é assim que o app desktop entrega tudo numa origem só.
 */
export function createApp(webDir?: string) {
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

  // Painel estático (modo app desktop / produção single-origin).
  if (webDir && existsSync(webDir)) {
    app.use(express.static(webDir));
    // SPA fallback: qualquer rota não-API devolve o index.html.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile('index.html', { root: webDir });
    });
  }

  return app;
}

/**
 * Sobe o servidor HTTP e devolve a porta efetiva.
 * Superfície usada pelo app desktop (Electron chama `iniciar(porta)`).
 *
 * @param port     Porta desejada (0 = o SO escolhe uma livre).
 * @param webDir   Build do painel a servir (opcional).
 * @param withWorker  Quando true, inicia o worker de segundo plano no mesmo
 *                    processo — usado no app desktop (background enquanto aberto).
 */
export async function iniciar(
  port = config.port,
  webDir?: string,
  withWorker = false,
): Promise<number> {
  // Na primeira execução (app desktop), cria o schema do banco se necessário.
  const { ensureSchema } = await import('./bootstrap.js');
  await ensureSchema();

  const app = createApp(webDir);
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(port, () => resolve(s));
  });
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;

  console.log(`[backend] API ouvindo em http://localhost:${actualPort}`);
  console.log(`[backend] IA ${config.gemini.enabled() ? 'ligada' : 'desligada'}`);

  if (withWorker) {
    // Importa dinamicamente para não acoplar o backend ao worker em outros usos.
    const { startBackgroundWorker } = await import('./worker/runner.js');
    startBackgroundWorker();
    console.log('[backend] worker de segundo plano iniciado (modo app).');
  }

  return actualPort;
}

// Execução direta via `node dist/index.js` (modo servidor tradicional).
if (import.meta.url === `file://${process.argv[1]}`) {
  void iniciar();
}
