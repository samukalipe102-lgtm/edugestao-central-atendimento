# EduGestão — Central de Atendimento Escolar

Central de atendimento escolar **operada por e-mail**. Organiza, acompanha e
responde solicitações recebidas por e-mail, com integrações reais:

- **Gmail** (`secretariaedugestao@gmail.com`) — conta oficial de **envio** (Gmail API, OAuth 2.0).
- **Gmail** (`admsedugestao@gmail.com`) — conta oficial de **recebimento** (Gmail API, OAuth 2.0).

> Este NÃO é um formulário de abertura de chamados. É uma central automatizada de
> gestão de atendimento por e-mail. Toda entrada de solicitação nasce de um e-mail
> real recebido; nenhum protocolo é criado manualmente.

## Princípios inegociáveis

1. **Nada fictício.** Sem alunos, protocolos, solicitações ou históricos inventados.
   Os dados oficiais vêm de PDFs/exports do EduGestão enviados pelo administrador.
2. **Envio sempre sob autorização.** A IA/sistema pode *preparar* mensagens; o envio
   depende de ação explícita do administrador.
3. **Nada "concluído" sem acontecer de verdade.** Um e-mail só é marcado como enviado
   quando a API retorna o `Message-ID`. Aceitação pela API ≠ entrega ao destinatário.
4. **Vinculação confiável.** Respostas são ligadas ao protocolo original por
   `Message-ID` / `References` / `In-Reply-To` + protocolo no assunto — nunca só pelo assunto.
5. **Conferência humana.** Identificação duvidosa vai para análise humana, sem criar
   solicitação automaticamente.

## Estrutura (monorepo)

```
packages/
  shared/    Tipos e contratos compartilhados (status, enums, DTOs)
  backend/   API REST + Prisma (fonte única de verdade) + Gmail (envio e recebimento)
  worker/    Processos em segundo plano (poll recebimento, fila de envio) — cron real
  web/       Painel administrativo (React + Vite), responsivo
desktop/     App Windows (Electron) que empacota backend + worker + painel
docs/        Guias de configuração (OAuth Gmail) e arquitetura
```

## Estado atual

| Módulo | Estado |
|---|---|
| Monorepo + banco (schema completo, migração aplicada) | pronto |
| API backend (auth, solicitações, fila, dashboard, relatórios, settings) | pronto e testado |
| Worker de segundo plano (poll recebimento + fila de envio, com pausa em falhas) | pronto |
| Painel web (responsivo, 6 telas) | pronto (build limpo) |
| Integração Gmail — envio (`secretariaedugestao@gmail.com`) | pronto; falta você conectar o OAuth |
| Integração Gmail — recebimento (`admsedugestao@gmail.com`) | pronto; falta você conectar o OAuth |
| Importação dos dados oficiais (PDF → base de pessoas) | pronto e testado |
| App desktop Windows (Electron) | pronto; `.exe` gerado por GitHub Actions em tags `v*` |
| IA de acompanhamento | desligada por opção (encaixe preparado para Gemini) |

Para rodar como servidor, veja `docs/SETUP.md`. Para rodar como app, veja
`desktop/README.md`. Para conectar as contas Gmail, veja `docs/INTEGRACAO-GMAIL.md`.
Para importar os dados oficiais da escola, veja `docs/IMPORTACAO-PDF.md` (ou, no
app, menu **Arquivo → Importar dados oficiais (PDF)**).

## Testes

```bash
npm test -w packages/backend   # lógica de vinculação e transições, com SQLite real
```
