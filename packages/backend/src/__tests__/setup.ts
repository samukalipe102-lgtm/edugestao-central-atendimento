import { execSync } from 'node:child_process';

// Define o banco de testes ANTES de qualquer módulo importar o Prisma Client
// (os setupFiles do vitest rodam antes dos arquivos de teste serem avaliados).
process.env.DATABASE_URL = 'file:./data/test.db';

// Aplica o schema uma única vez para a sessão de testes.
// setup.ts está em src/__tests__/ → a raiz do backend fica dois níveis acima.
const backendRoot = new URL('../../', import.meta.url).pathname;
execSync('npx prisma migrate deploy', {
  cwd: backendRoot,
  stdio: 'ignore',
  env: { ...process.env },
});
