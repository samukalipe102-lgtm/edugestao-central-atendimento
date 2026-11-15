# Importação dos dados oficiais (PDF)

A base de pessoas (alunos, responsáveis, professores) é preenchida **somente**
a partir dos PDFs oficiais da escola. Nada é inventado: campo ausente fica nulo
e é marcado como inconsistência.

## Regras de privacidade (LGPD)

- Os PDFs com PII de menores **nunca** são versionados nem enviados ao GitHub.
  Ficam em `data/source-pdfs/`, ignorada pelo git.
- **Senhas temporárias** que apareçam nos PDFs são **descartadas na extração** —
  nunca gravadas no banco nem registradas em log.
- A trilha de auditoria guarda apenas contagens do lote, sem PII.

## Como importar

1. Copie os PDFs oficiais para `data/source-pdfs/`.
2. (Opcional) Simule primeiro, sem gravar nada, para conferir a leitura:

   ```bash
   cd packages/backend
   npx tsx src/scripts/importPdfs.ts --dry
   ```

   A simulação lista os primeiros registros detectados (tipo, nome, e-mail,
   documento). Use-a para confirmar que o layout foi lido corretamente.

3. Importação real:

   ```bash
   npx tsx src/scripts/importPdfs.ts
   ```

### Opções

- `npx tsx src/scripts/importPdfs.ts <pasta>` — usa outra pasta de PDFs.
- `--kind ALUNO|RESPONSAVEL|PROFESSOR|FUNCIONARIO` — tipo presumido quando o
  PDF não traz rótulo (padrão `ALUNO`). Útil se um PDF for só de professores,
  por exemplo.
- `--dry` — simulação, não grava.

## O que acontece em cada importação

- Cria um **lote** (`ImportBatch`) com data, origem e um resumo (contagens).
- Cada pessoa aponta para o lote → a importação é **reversível** e tem histórico
  (lotes anteriores nunca são apagados).
- **Duplicatas** são detectadas por e-mail, depois documento, depois nome+tipo —
  dentro do mesmo PDF e contra a base já existente.
- **Inconsistências** (sem e-mail, sem documento, e-mail inválido) são listadas
  ao final e marcam o registro, sem bloquear a importação.
- **Reimportar o mesmo conteúdo** é bloqueado (hash do texto). Para reimportar,
  desfaça o lote anterior.

## Desfazer um lote

A função `revertImport(batchId)` remove as pessoas daquele lote e o próprio
lote, numa transação. (Exposição por tela/menu pode ser adicionada depois.)

## Ajuste ao layout real dos PDFs

A leitura fica em `packages/backend/src/services/import/parsePeople.ts`
(função `parsePeopleFromText`). As heurísticas atuais atendem listas simples
(uma pessoa por linha, com e-mail e/ou matrícula). Se um PDF oficial tiver um
formato diferente (tabela, uma pessoa por página, colunas fixas), **só essa
função precisa de ajuste** — a lógica de importação reversível
(`importPeople.ts`) não muda.
