import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from './db.js';

/**
 * Inicializa o schema do banco na primeira execução, aplicando os arquivos de
 * migração SQL. Usado pelo app desktop, onde o CLI do Prisma não está disponível
 * em tempo de execução. Idempotente: se as tabelas já existem, não faz nada.
 */
export async function ensureSchema(): Promise<void> {
  // Já inicializado? (tabela AdminUser existe)
  try {
    await prisma.$queryRawUnsafe('SELECT 1 FROM "AdminUser" LIMIT 1');
    return;
  } catch {
    // Tabela ausente → aplicar migrações.
  }

  const migrationsDir = locateMigrationsDir();
  if (!migrationsDir) {
    console.warn('[bootstrap] pasta de migrações não encontrada; schema não aplicado.');
    return;
  }

  const dirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const dir of dirs) {
    const sqlPath = join(migrationsDir, dir, 'migration.sql');
    if (!existsSync(sqlPath)) continue;
    const sql = readFileSync(sqlPath, 'utf8');
    // Executa statement a statement (SQLite não aceita múltiplos num exec só via Prisma).
    for (const stmt of splitSql(sql)) {
      await prisma.$executeRawUnsafe(stmt);
    }
    console.log(`[bootstrap] migração aplicada: ${dir}`);
  }
}

function splitSql(sql: string): string[] {
  // Remove linhas de comentário (-- ...) antes de dividir em statements.
  const withoutComments = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  return withoutComments
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Procura a pasta de migrações nos layouts de dev e empacotado. */
function locateMigrationsDir(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '..', 'prisma', 'migrations'), // dist/ → ../prisma (empacotado: backend/prisma)
    join(here, '..', '..', 'prisma', 'migrations'), // dev: src/ → ../../prisma
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}
