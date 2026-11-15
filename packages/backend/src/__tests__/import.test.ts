import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '../db.js';
import { parsePeopleFromText } from '../services/import/parsePeople.js';
import { importPeople, revertImport } from '../services/import/importPeople.js';

/**
 * Testes do importador de dados oficiais. Banco SQLite temporário real.
 * Valida: descarte de senha, parsing, dedup, flags de inconsistência,
 * reversibilidade e bloqueio de reimportação idêntica.
 */

// Texto que imita uma lista exportada — inclui UMA linha de senha temporária,
// que NÃO pode virar registro nem aparecer em lugar nenhum.
const AMOSTRA = [
  'Lista de Alunos - E.E. Exemplo - 2026',
  'Aluno: Ana Souza  RA 123456789  ana.souza@escola.exemplo',
  'Aluno: Bruno Lima  RA 987654321  bruno.lima@escola.exemplo',
  'Responsável: Carla Lima  carla.lima@email.exemplo  111.222.333-44',
  'Aluno: Ana Souza  RA 123456789  ana.souza@escola.exemplo', // duplicado exato
  'Aluno: Diego Alves', // sem email e sem documento → inconsistência
  'Senha temporária: Diego Alves  diego123!  SENHA-NAO-DEVE-APARECER',
].join('\n');

afterAll(async () => {
  await prisma.officialPerson.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.auditLog.deleteMany();
});

describe('parser de PDF (texto)', () => {
  it('descarta a linha de senha temporária por completo', () => {
    const people = parsePeopleFromText(AMOSTRA);
    const anySenha = people.some(
      (p) =>
        /senha/i.test(p.sourceLine) ||
        p.name?.includes('diego123') ||
        JSON.stringify(p).includes('SENHA-NAO-DEVE-APARECER'),
    );
    expect(anySenha).toBe(false);
  });

  it('reconhece alunos e responsáveis com e-mail e documento', () => {
    const people = parsePeopleFromText(AMOSTRA);
    const ana = people.find((p) => p.email === 'ana.souza@escola.exemplo');
    expect(ana).toBeDefined();
    expect(ana?.kind).toBe('ALUNO');
    const carla = people.find((p) => p.email === 'carla.lima@email.exemplo');
    expect(carla?.kind).toBe('RESPONSAVEL');
  });
});

describe('importação reversível', () => {
  it('importa, deduplica e marca inconsistências sem inventar', async () => {
    const people = parsePeopleFromText(AMOSTRA);
    const result = await importPeople({
      sourceName: 'amostra.pdf',
      sourceText: AMOSTRA,
      people,
      importedBy: 'teste',
    });

    // Ana aparece 2x no texto → só 1 criada.
    expect(result.duplicatesSkipped).toBeGreaterThanOrEqual(1);
    // Diego sem email/doc → inconsistência registrada.
    const diego = result.inconsistencies.find((i) => i.name?.includes('Diego'));
    expect(diego?.flags).toContain('SEM_EMAIL');
    expect(diego?.flags).toContain('SEM_DOCUMENTO');

    const count = await prisma.officialPerson.count({ where: { importId: result.batchId } });
    expect(count).toBe(result.created);

    // Nenhuma senha vazou para o banco.
    const leaked = await prisma.officialPerson.findMany();
    expect(leaked.some((p) => JSON.stringify(p).includes('SENHA-NAO-DEVE-APARECER'))).toBe(false);
  });

  it('bloqueia reimportação idêntica', async () => {
    const people = parsePeopleFromText(AMOSTRA);
    await expect(
      importPeople({ sourceName: 'amostra.pdf', sourceText: AMOSTRA, people, importedBy: 'teste' }),
    ).rejects.toThrow(/já foi importado/i);
  });

  it('desfaz um lote (reversível)', async () => {
    const batch = await prisma.importBatch.findFirst({ orderBy: { createdAt: 'desc' } });
    expect(batch).toBeTruthy();
    const removed = await revertImport(batch!.id);
    expect(removed).toBeGreaterThan(0);
    const after = await prisma.officialPerson.count({ where: { importId: batch!.id } });
    expect(after).toBe(0);
  });
});
