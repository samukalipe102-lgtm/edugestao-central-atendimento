import { basename } from 'node:path';
import { extractPdfText } from './pdfText.js';
import { parsePeopleFromText } from './parsePeople.js';
import { importPeople, type ImportResult } from './importPeople.js';
import { PERSON_KIND, type PersonKind } from '@edugestao/shared';

export * from './pdfText.js';
export * from './parsePeople.js';
export * from './importPeople.js';

export interface ImportFileOutcome {
  file: string;
  ok: boolean;
  result?: ImportResult;
  error?: string;
}

/**
 * Orquestra a importação de um ou mais PDFs: extrai texto, parseia e grava,
 * cada arquivo como seu próprio lote. Usado pelo script CLI e pelo app desktop.
 *
 * Nunca lança para o chamador por causa de um arquivo ruim — devolve o
 * resultado por arquivo, para a interface mostrar o que entrou e o que falhou.
 */
export async function importarPdfs(params: {
  files: string[];
  defaultKind?: PersonKind;
  importedBy: string;
  actorId?: string | null;
}): Promise<ImportFileOutcome[]> {
  const kind = params.defaultKind ?? PERSON_KIND.ALUNO;
  const out: ImportFileOutcome[] = [];

  for (const file of params.files) {
    try {
      const { text } = await extractPdfText(file);
      const people = parsePeopleFromText(text, kind);
      const result = await importPeople({
        sourceName: basename(file),
        sourceText: text,
        people,
        importedBy: params.importedBy,
        actorId: params.actorId ?? null,
      });
      out.push({ file: basename(file), ok: true, result });
    } catch (e) {
      out.push({
        file: basename(file),
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return out;
}
