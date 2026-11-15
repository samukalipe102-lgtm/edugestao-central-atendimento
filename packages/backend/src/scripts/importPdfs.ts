import 'dotenv/config';
import { readdir } from 'node:fs/promises';
import { resolve, join, basename } from 'node:path';
import { prisma } from '../db.js';
import {
  extractPdfText,
  parsePeopleFromText,
  importPeople,
  type ParsedPerson,
} from '../services/import/index.js';
import { PERSON_KIND, PERSON_KIND_LABEL, type PersonKind } from '@edugestao/shared';

/**
 * Importa os PDFs oficiais da escola para a base.
 *
 * Uso:
 *   npx tsx src/scripts/importPdfs.ts [pasta] [--kind ALUNO|RESPONSAVEL|PROFESSOR|FUNCIONARIO] [--dry]
 *
 * Padrão da pasta: ../../data/source-pdfs (na raiz do repositório).
 *   --kind  tipo presumido quando o PDF não traz rótulo (padrão ALUNO).
 *   --dry   só mostra o que seria importado, sem gravar nada.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const kindIdx = args.indexOf('--kind');
  const kindValueIdx = kindIdx >= 0 ? kindIdx + 1 : -1;
  const defaultKind: PersonKind =
    kindIdx >= 0 && args[kindValueIdx] && args[kindValueIdx] in PERSON_KIND
      ? (args[kindValueIdx] as PersonKind)
      : PERSON_KIND.ALUNO;
  // Posicionais = tudo que não é flag e não é o valor de --kind.
  const positional = args.filter(
    (a, i) => !a.startsWith('--') && i !== kindValueIdx,
  );
  const dir = resolve(positional[0] ?? resolve(process.cwd(), '../../data/source-pdfs'));

  console.log(`Pasta de PDFs: ${dir}`);
  console.log(`Tipo presumido: ${PERSON_KIND_LABEL[defaultKind]}`);
  console.log(dry ? 'Modo: SIMULAÇÃO (nada será gravado)\n' : 'Modo: IMPORTAÇÃO REAL\n');

  let entries: string[];
  try {
    entries = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.pdf'));
  } catch {
    console.error(`Não consegui ler a pasta ${dir}. Ela existe?`);
    process.exit(1);
  }

  if (entries.length === 0) {
    console.error(
      `Nenhum PDF encontrado em ${dir}.\n` +
        `Coloque os PDFs oficiais ali e rode novamente.`,
    );
    process.exit(1);
  }

  for (const file of entries) {
    const full = join(dir, file);
    console.log(`\n=== ${file} ===`);
    const { text, pages } = await extractPdfText(full);
    console.log(`Páginas: ${pages} | Caracteres extraídos: ${text.length}`);

    const people: ParsedPerson[] = parsePeopleFromText(text, defaultKind);
    console.log(`Registros detectados: ${people.length}`);

    if (people.length === 0) {
      console.warn(
        'Nenhum registro reconhecido. O layout deste PDF provavelmente precisa ' +
          'de ajuste no parser (parsePeople.ts). Rode com --dry para inspecionar.',
      );
    }

    if (dry) {
      // Prévia sem gravar — ajuda a calibrar o parser ao formato real.
      people.slice(0, 15).forEach((p, i) => {
        console.log(
          `  [${i + 1}] ${PERSON_KIND_LABEL[p.kind]} | nome=${p.name ?? '—'} | ` +
            `email=${p.email ?? '—'} | doc=${p.document ?? '—'}`,
        );
      });
      if (people.length > 15) console.log(`  ... (+${people.length - 15} registros)`);
      continue;
    }

    const result = await importPeople({
      sourceName: basename(file),
      sourceText: text,
      people,
      importedBy: 'script:importPdfs',
    });

    console.log(`Lote: ${result.batchId}`);
    console.log(`Criados: ${result.created} | Duplicados ignorados: ${result.duplicatesSkipped}`);
    if (result.inconsistencies.length > 0) {
      console.log(`Inconsistências (${result.inconsistencies.length}) — campos ausentes, nada inventado:`);
      result.inconsistencies.slice(0, 10).forEach((inc) => {
        console.log(`  - ${inc.name ?? '(sem nome)'}: ${inc.flags.join(', ')}`);
      });
      if (result.inconsistencies.length > 10)
        console.log(`  ... (+${result.inconsistencies.length - 10})`);
    }
  }

  console.log('\nConcluído.');
}

main()
  .catch((e) => {
    console.error('Erro na importação:', e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
