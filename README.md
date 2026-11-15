# EduGestão — Central de Atendimento Escolar

Central de atendimento escolar **operada por e-mail**. Organiza, acompanha e
responde solicitações recebidas por e-mail, com integrações reais:

- **Gmail** (`secretariaedugestao@gmail.com`) — conta oficial de **envio** (Gmail API, OAuth 2.0).
- **Outlook** (`admsedugestao@outlook.com`) — conta oficial de **recebimento** (Microsoft Graph API).

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
  backend/   API REST + Prisma (fonte única de verdade) + Gmail/Graph
  worker/    Processos em segundo plano (poll Outlook, fila de envio) — cron real
  web/       Painel administrativo (React + Vite), responsivo
docs/        Guias de configuração (OAuth Gmail, Azure/Graph), arquitetura
```

## Estado atual

| Módulo | Estado |
|---|---|
| Esqueleto do monorepo | em construção |
| Schema do banco | em construção |
| Integração Gmail (envio) | pendente de credenciais OAuth |
| Integração Outlook (recebimento) | pendente de registro no Azure |
| IA de acompanhamento | desligada por opção (encaixe preparado para Gemini) |

Consulte `docs/` para configurar as integrações.
