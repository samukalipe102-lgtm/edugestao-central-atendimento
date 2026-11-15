import { createHash } from 'node:crypto';
import { prisma } from '../../db.js';
import { audit } from '../audit.js';
import { IMPORT_FLAG, type ImportFlag } from '@edugestao/shared';
import type { ParsedPerson } from './parsePeople.js';

const EMAIL_VALID_RE = /^[\w.+-]+@[\w-]+\.[\w.-]+$/;

export interface PersonInconsistency {
  sourceLine: string;
  name?: string;
  flags: ImportFlag[];
}

export interface ImportResult {
  batchId: string;
  sourceName: string;
  totalParsed: number;
  created: number;
  duplicatesSkipped: number;
  inconsistencies: PersonInconsistency[];
}

/** Chave de deduplicação: e-mail quando houver, senão documento, senão nome+tipo. */
function dedupeKey(p: ParsedPerson): string {
  if (p.email) return `email:${p.email}`;
  if (p.document) return `doc:${p.document.replace(/\D/g, '')}`;
  return `name:${(p.name ?? '').toLowerCase()}|${p.kind}`;
}

/** Marca inconsistências de um registro sem descartá-lo (nada é inventado). */
function detectFlags(p: ParsedPerson): ImportFlag[] {
  const flags: ImportFlag[] = [];
  if (!p.name) flags.push(IMPORT_FLAG.SEM_NOME);
  if (!p.email) flags.push(IMPORT_FLAG.SEM_EMAIL);
  else if (!EMAIL_VALID_RE.test(p.email)) flags.push(IMPORT_FLAG.EMAIL_INVALIDO);
  if (!p.document) flags.push(IMPORT_FLAG.SEM_DOCUMENTO);
  return flags;
}

/**
 * Importa uma lista de pessoas extraídas, de forma REVERSÍVEL e rastreável.
 *
 * - Cria um ImportBatch; todas as pessoas apontam para ele.
 * - Tudo numa única transação: ou entra o lote inteiro, ou nada.
 * - Duplicatas (dentro do lote e contra a base existente) são puladas.
 * - Campos ausentes viram flags de inconsistência — não impedem a importação.
 * - A senha temporária já foi descartada no parser; aqui ela nunca chega.
 *
 * Para DESFAZER um lote: deleta as OfficialPerson com aquele importId e o
 * ImportBatch (ver revertImport).
 */
export async function importPeople(params: {
  sourceName: string;
  sourceText: string;
  people: ParsedPerson[];
  importedBy: string;
  actorId?: string | null;
}): Promise<ImportResult> {
  const { sourceName, sourceText, people, importedBy } = params;
  const sourceHash = createHash('sha256').update(sourceText).digest('hex');

  // Reimportação idêntica? Avisa em vez de duplicar silenciosamente.
  const prior = await prisma.importBatch.findFirst({ where: { sourceHash } });
  if (prior) {
    throw new Error(
      `Este conteúdo já foi importado no lote ${prior.id} (${prior.createdAt.toISOString()}). ` +
        `Para reimportar, desfaça o lote anterior primeiro.`,
    );
  }

  const inconsistencies: PersonInconsistency[] = [];
  const seenInBatch = new Set<string>();
  let duplicatesSkipped = 0;

  // Pré-processa: dedup intra-lote + coleta de flags.
  const toInsert: ParsedPerson[] = [];
  for (const p of people) {
    const key = dedupeKey(p);
    if (seenInBatch.has(key)) {
      duplicatesSkipped++;
      continue;
    }
    seenInBatch.add(key);

    const flags = detectFlags(p);
    if (flags.length > 0) {
      inconsistencies.push({ sourceLine: p.sourceLine, name: p.name, flags });
    }
    toInsert.push(p);
  }

  // Dedup contra a base já existente (por e-mail ou documento).
  const emails = toInsert.map((p) => p.email).filter((e): e is string => !!e);
  const docs = toInsert.map((p) => p.document).filter((d): d is string => !!d);
  const existing = await prisma.officialPerson.findMany({
    where: { OR: [{ email: { in: emails } }, { document: { in: docs } }] },
    select: { email: true, document: true },
  });
  const existingEmails = new Set(existing.map((e) => e.email?.toLowerCase()).filter(Boolean));
  const existingDocs = new Set(
    existing.map((e) => e.document?.replace(/\D/g, '')).filter(Boolean),
  );

  const finalInsert = toInsert.filter((p) => {
    const dupEmail = p.email && existingEmails.has(p.email.toLowerCase());
    const dupDoc = p.document && existingDocs.has(p.document.replace(/\D/g, ''));
    if (dupEmail || dupDoc) {
      duplicatesSkipped++;
      return false;
    }
    return true;
  });

  const summary = {
    totalParsed: people.length,
    created: finalInsert.length,
    duplicatesSkipped,
    inconsistencyCount: inconsistencies.length,
    byKind: finalInsert.reduce<Record<string, number>>((acc, p) => {
      acc[p.kind] = (acc[p.kind] ?? 0) + 1;
      return acc;
    }, {}),
  };

  // Transação: lote + pessoas entram juntos, ou nada entra.
  const batchId = await prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        sourceName,
        sourceHash,
        importedBy,
        summary: JSON.stringify(summary),
      },
    });

    for (const p of finalInsert) {
      await tx.officialPerson.create({
        data: {
          kind: p.kind,
          name: p.name ?? '(sem nome)',
          email: p.email ?? null,
          document: p.document ?? null,
          // rawData NUNCA inclui a linha de senha (descartada no parser).
          rawData: JSON.stringify({ extra: p.extra, sourceLine: p.sourceLine }),
          importId: batch.id,
        },
      });
    }

    return batch.id;
  });

  await audit({
    actorId: params.actorId ?? null,
    action: 'IMPORT_OFFICIAL_PEOPLE',
    entityType: 'ImportBatch',
    entityId: batchId,
    // metadata sem PII: só contagens.
    metadata: summary,
  });

  return {
    batchId,
    sourceName,
    totalParsed: people.length,
    created: finalInsert.length,
    duplicatesSkipped,
    inconsistencies,
  };
}

/** Desfaz um lote: remove as pessoas daquele importId e o próprio lote. */
export async function revertImport(batchId: string, actorId?: string | null): Promise<number> {
  const removed = await prisma.$transaction(async (tx) => {
    const del = await tx.officialPerson.deleteMany({ where: { importId: batchId } });
    await tx.importBatch.delete({ where: { id: batchId } });
    return del.count;
  });
  await audit({
    actorId: actorId ?? null,
    action: 'REVERT_IMPORT',
    entityType: 'ImportBatch',
    entityId: batchId,
    metadata: { removed },
  });
  return removed;
}
