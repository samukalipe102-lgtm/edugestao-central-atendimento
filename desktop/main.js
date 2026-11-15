/**
 * Processo principal do app desktop EduGestão — Central de Atendimento.
 *
 * Numa única janela instalável:
 *   - Sobe o backend (API + worker de segundo plano) NO MESMO PROCESSO, numa
 *     porta local fixa, com o painel web servido pelo próprio backend.
 *   - Carrega o painel na janela Chromium.
 *
 * O worker roda enquanto o app está aberto (acompanhamento automático do
 * recebimento e da fila de envio). Fechou o app, pausa; abriu, retoma — o
 * estado fica no banco (data/), que vive FORA do binário.
 *
 * Credenciais (Client ID/Secret do Google, chave de IA, segredos) ficam em
 * userData/config.json, nunca embutidas no executável.
 */

import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { carregarConfig, salvarConfig, caminhoConfig } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORTA = 47620;

let janela = null;
let portaServidor = 0;
let servidorIniciado = false;
let backendMod = null; // módulo do backend já carregado (expõe importarPdfs)

/** Raiz dos recursos empacotados (resources/app) vs. desenvolvimento. */
function raizRecursos() {
  return app.isPackaged ? join(process.resourcesPath, 'app') : resolve(__dirname, '..');
}

/** Pasta de dados persistentes (banco SQLite + tokens), ao lado do app/userData. */
function pastaDados() {
  const dir = join(app.getPath('userData'), 'data');
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Aplica as variáveis de ambiente antes de subir o backend. */
function aplicarEnv() {
  const cfg = carregarConfig();
  const dados = pastaDados();

  process.env.PORT = String(PORTA);
  process.env.DATABASE_URL = `file:${join(dados, 'edugestao.db')}`;

  // Redirect URIs OAuth apontam para a porta local do app.
  const base = `http://localhost:${PORTA}/api/integrations`;
  process.env.GMAIL_SEND_REDIRECT_URI = `${base}/gmail-send/callback`;
  process.env.GMAIL_RECV_REDIRECT_URI = `${base}/gmail-recv/callback`;

  // Segredos: usa o que o usuário configurou; se não houver, gera/defaults seguros.
  process.env.JWT_SECRET = cfg.JWT_SECRET || process.env.JWT_SECRET || 'app-local-secret';
  if (cfg.TOKEN_ENCRYPTION_KEY) process.env.TOKEN_ENCRYPTION_KEY = cfg.TOKEN_ENCRYPTION_KEY;

  delete process.env.GMAIL_CLIENT_ID;
  delete process.env.GMAIL_CLIENT_SECRET;
  delete process.env.GEMINI_API_KEY;
  if (cfg.GMAIL_CLIENT_ID) process.env.GMAIL_CLIENT_ID = cfg.GMAIL_CLIENT_ID;
  if (cfg.GMAIL_CLIENT_SECRET) process.env.GMAIL_CLIENT_SECRET = cfg.GMAIL_CLIENT_SECRET;
  if (cfg.GEMINI_API_KEY) process.env.GEMINI_API_KEY = cfg.GEMINI_API_KEY;
}

/** Sobe o backend (API + worker + painel) no mesmo processo. */
async function iniciarServidor() {
  if (servidorIniciado) return portaServidor;
  aplicarEnv();
  const raiz = raizRecursos();

  // Servimos o backend a partir do seu build (dist). Prisma (client gerado +
  // engine) e demais dependências nativas vão empacotados em node_modules —
  // sem tentar embutir o engine do Prisma num bundle (que varia por SO).
  const candidatos = [
    join(raiz, 'backend', 'dist', 'index.js'),
    join(raiz, 'packages', 'backend', 'dist', 'index.js'),
  ];
  const entry = candidatos.find((c) => existsSync(c));
  if (!entry) {
    throw new Error(
      'Backend não encontrado. Esperado backend/dist/index.js. Tentados:\n  ' +
        candidatos.join('\n  '),
    );
  }

  const webDir = join(raiz, 'web');
  const mod = await import(pathToFileURL(entry).href);
  backendMod = mod;
  const iniciar = mod.iniciar || mod.default?.iniciar;
  if (typeof iniciar !== 'function') {
    throw new Error("O módulo do backend não exporta 'iniciar'.");
  }
  // iniciar(porta, webDir, withWorker=true) → worker roda com o app aberto.
  portaServidor = await iniciar(PORTA, existsSync(webDir) ? webDir : undefined, true);
  servidorIniciado = true;
  return portaServidor;
}

async function criarJanela() {
  janela = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: 'EduGestão — Central de Atendimento',
    backgroundColor: '#f4f6f9',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  await janela.loadURL(`http://localhost:${portaServidor}/`);
  janela.on('closed', () => (janela = null));
}

/**
 * Importa dados oficiais a partir de PDFs escolhidos pelo usuário.
 * Abre um seletor de arquivos, chama o importador do backend e mostra o resumo.
 * Os PDFs não são copiados nem guardados — só lidos para extração.
 */
async function importarDadosOficiais() {
  if (!backendMod || typeof backendMod.importarPdfs !== 'function') {
    await dialog.showMessageBox(janela ?? undefined, {
      type: 'error',
      title: 'Importação indisponível',
      message: 'O servidor interno ainda não terminou de iniciar. Tente novamente em instantes.',
    });
    return;
  }

  const escolha = await dialog.showOpenDialog(janela ?? undefined, {
    title: 'Selecione os PDFs oficiais da escola',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (escolha.canceled || escolha.filePaths.length === 0) return;

  // Pergunta o tipo presumido (caso o PDF não traga rótulos claros).
  const { response: tipoIdx } = await dialog.showMessageBox(janela ?? undefined, {
    type: 'question',
    title: 'Tipo de pessoas neste(s) PDF(s)',
    message: 'Se o PDF não indicar o tipo, qual é o conteúdo predominante?',
    detail:
      'Registros que o próprio PDF rotular (ex.: "Responsável") são classificados automaticamente; ' +
      'os demais usam esta opção.',
    buttons: ['Alunos', 'Responsáveis', 'Professores', 'Funcionários', 'Cancelar'],
    cancelId: 4,
    defaultId: 0,
  });
  if (tipoIdx === 4) return;
  const kinds = ['ALUNO', 'RESPONSAVEL', 'PROFESSOR', 'FUNCIONARIO'];
  const defaultKind = kinds[tipoIdx] ?? 'ALUNO';

  try {
    const outcomes = await backendMod.importarPdfs({
      files: escolha.filePaths,
      defaultKind,
      importedBy: 'app:desktop',
    });

    const linhas = outcomes.map((o) => {
      if (!o.ok) return `✗ ${o.file}: ${o.error}`;
      const r = o.result;
      let s = `✓ ${o.file}: ${r.created} cadastrado(s), ${r.duplicatesSkipped} duplicado(s) ignorado(s)`;
      if (r.inconsistencies.length > 0) {
        s += `, ${r.inconsistencies.length} com dados incompletos`;
      }
      return s;
    });

    const algumOk = outcomes.some((o) => o.ok);
    await dialog.showMessageBox(janela ?? undefined, {
      type: algumOk ? 'info' : 'warning',
      title: 'Importação concluída',
      message: algumOk ? 'Dados oficiais importados.' : 'Nenhum PDF pôde ser importado.',
      detail: linhas.join('\n'),
    });
    // Atualiza o painel para refletir a nova base.
    janela?.webContents.reload();
  } catch (e) {
    await dialog.showMessageBox(janela ?? undefined, {
      type: 'error',
      title: 'Erro na importação',
      message: 'Não foi possível concluir a importação.',
      detail: String(e && e.stack ? e.stack : e),
    });
  }
}

function montarMenu() {
  const template = [
    {
      label: 'Arquivo',
      submenu: [
        {
          label: 'Configurar credenciais…',
          click: () => janela?.webContents.send('abrir-config'),
        },
        {
          label: 'Importar dados oficiais (PDF)…',
          click: () => void importarDadosOficiais(),
        },
        { type: 'separator' },
        { role: 'reload', label: 'Recarregar' },
        { role: 'toggleDevTools', label: 'Ferramentas de desenvolvedor' },
        { type: 'separator' },
        { role: 'quit', label: 'Sair' },
      ],
    },
    {
      label: 'Ajuda',
      submenu: [
        {
          label: 'Google Cloud (credenciais OAuth)',
          click: () => shell.openExternal('https://console.cloud.google.com/apis/credentials'),
        },
        {
          label: 'Pegar chave gratuita (Gemini)',
          click: () => shell.openExternal('https://aistudio.google.com/apikey'),
        },
        {
          label: 'Local do arquivo de configuração',
          click: () => shell.showItemInFolder(caminhoConfig()),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('config:ler', () => carregarConfig());
ipcMain.handle('config:salvar', (_e, nova) => {
  salvarConfig(nova);
  // As credenciais só entram em vigor na próxima inicialização do servidor.
  return { ok: true, requerReinicio: true };
});

app.whenReady().then(async () => {
  montarMenu();
  try {
    await iniciarServidor();
    await criarJanela();
  } catch (e) {
    await dialog.showMessageBox({
      type: 'error',
      title: 'Falha ao iniciar o EduGestão',
      message: 'O servidor interno não pôde iniciar.',
      detail: String(e && e.stack ? e.stack : e),
    });
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
