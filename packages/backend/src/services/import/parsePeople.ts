import { PERSON_KIND, type PersonKind } from '@edugestao/shared';

/**
 * Registro de pessoa extraído de um PDF, ANTES de persistir.
 * Campos ausentes ficam `undefined` — nunca inventados.
 */
export interface ParsedPerson {
  kind: PersonKind;
  name?: string;
  email?: string;
  document?: string;
  /** Campos crus adicionais (turma, telefone do responsável, etc.). */
  extra: Record<string, string>;
  /** Linha(s) de origem no texto, para auditoria e depuração. */
  sourceLine: string;
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
// CPF (com ou sem máscara) ou matrícula/RA numérica longa.
const DOC_RE = /\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\d{8,12})\b/;
// Palavras que denunciam uma senha temporária — a linha é descartada por
// completo para a senha nunca entrar em memória persistida/log.
const SENHA_RE = /\b(senha|password|senha\s*tempor[áa]ria|senha\s*inicial)\b/i;

/** Remove espaços repetidos e normaliza. */
function tidy(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Heurística para o tipo de pessoa a partir de rótulos no texto. */
function inferKind(line: string, fallback: PersonKind): PersonKind {
  const l = line.toLowerCase();
  if (/\b(respons[áa]vel|m[ãa]e|pai|guardi[ãa]o|filiac|filia[çc][ãa]o)\b/.test(l))
    return PERSON_KIND.RESPONSAVEL;
  if (/\b(professor|docente)\b/.test(l)) return PERSON_KIND.PROFESSOR;
  if (/\b(funcion[áa]rio|secretaria|servidor)\b/.test(l))
    return PERSON_KIND.FUNCIONARIO;
  if (/\b(aluno|estudante|discente|matr[íi]cula|ra\b)\b/.test(l))
    return PERSON_KIND.ALUNO;
  return fallback;
}

/**
 * Converte o texto de um PDF em registros de pessoa.
 *
 * IMPORTANTE: esta é a CAMADA AJUSTÁVEL. As heurísticas abaixo (linha-a-linha,
 * detecção de e-mail/documento) funcionam para listas simples. Assim que o
 * layout real dos PDFs for conhecido, calibre apenas esta função — a lógica de
 * importação (importPeople) não muda.
 *
 * @param defaultKind tipo presumido quando o texto não traz rótulo claro.
 */
export function parsePeopleFromText(
  text: string,
  defaultKind: PersonKind = PERSON_KIND.ALUNO,
): ParsedPerson[] {
  const people: ParsedPerson[] = [];
  const lines = text.split(/\r?\n/);

  for (const raw of lines) {
    const line = tidy(raw);
    if (!line) continue;

    // Descarta integralmente qualquer linha que contenha senha temporária.
    // A senha nunca é lida, guardada ou registrada.
    if (SENHA_RE.test(line)) continue;

    const emailMatch = line.match(EMAIL_RE);
    const docMatch = line.match(DOC_RE);

    // Uma linha só vira pessoa se tiver pelo menos e-mail OU documento OU
    // parecer claramente um registro (tem rótulo de tipo). Evita capturar
    // cabeçalhos e rodapés.
    const labeled =
      /\b(aluno|estudante|respons[áa]vel|professor|docente|funcion[áa]rio|matr[íi]cula|ra\b|cpf)\b/i.test(
        line,
      );
    if (!emailMatch && !docMatch && !labeled) continue;

    const kind = inferKind(line, defaultKind);

    // Nome: remove e-mail e documento da linha e usa o que sobra como nome
    // provável. É uma aproximação — refinar com o layout real.
    let namePart = line;
    if (emailMatch) namePart = namePart.replace(emailMatch[0], '');
    if (docMatch) namePart = namePart.replace(docMatch[0], '');
    namePart = tidy(
      namePart
        // tira rótulos comuns do começo
        .replace(
          /^(aluno|estudante|respons[áa]vel|professor|docente|funcion[áa]rio|nome|matr[íi]cula|ra|rg|cpf|e-?mail)\s*[:\-]?\s*/i,
          '',
        )
        // tira rótulos de documento que ficaram soltos onde estava o número
        .replace(/\b(matr[íi]cula|ra|rg|cpf|n[ºo°.]?)\b/gi, ' ')
        .replace(/[|;]+/g, ' '),
    );

    people.push({
      kind,
      name: namePart || undefined,
      email: emailMatch ? emailMatch[0].toLowerCase() : undefined,
      document: docMatch ? docMatch[0] : undefined,
      extra: {},
      sourceLine: line,
    });
  }

  return people;
}
