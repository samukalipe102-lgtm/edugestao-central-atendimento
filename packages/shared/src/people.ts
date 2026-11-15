/**
 * Tipos de pessoa oficial do EduGestão.
 * Preenchidos SOMENTE a partir de documentos oficiais importados.
 */
export const PERSON_KIND = {
  ALUNO: 'ALUNO',
  RESPONSAVEL: 'RESPONSAVEL',
  PROFESSOR: 'PROFESSOR',
  FUNCIONARIO: 'FUNCIONARIO',
} as const;

export type PersonKind = (typeof PERSON_KIND)[keyof typeof PERSON_KIND];

export const PERSON_KIND_LABEL: Record<PersonKind, string> = {
  ALUNO: 'Aluno(a)',
  RESPONSAVEL: 'Responsável',
  PROFESSOR: 'Professor(a)',
  FUNCIONARIO: 'Funcionário(a)',
};

/** Motivo pelo qual um registro importado foi marcado como inconsistente. */
export const IMPORT_FLAG = {
  SEM_EMAIL: 'SEM_EMAIL',
  SEM_NOME: 'SEM_NOME',
  SEM_DOCUMENTO: 'SEM_DOCUMENTO',
  EMAIL_INVALIDO: 'EMAIL_INVALIDO',
  DUPLICADO: 'DUPLICADO',
} as const;

export type ImportFlag = (typeof IMPORT_FLAG)[keyof typeof IMPORT_FLAG];
