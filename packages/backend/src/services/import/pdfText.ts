import { readFile } from 'node:fs/promises';
import { extractText, getDocumentProxy } from 'unpdf';

export interface PdfTextResult {
  /** Texto completo extraído do PDF. */
  text: string;
  /** Número de páginas. */
  pages: number;
}

/**
 * Lê um PDF do disco e devolve o texto extraído.
 *
 * Usa `unpdf` (pdf.js da Mozilla, mantido; sem dependências nativas), o que
 * garante que o mesmo código empacota no app Electron sem binário por SO.
 * O conteúdo bruto não é guardado em lugar nenhum além do retorno em memória.
 */
export async function extractPdfText(filePath: string): Promise<PdfTextResult> {
  const buffer = await readFile(filePath);
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  // mergePages: true → `text` é uma única string com todas as páginas.
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join('\n') : text;
  return { text: merged, pages: totalPages };
}
