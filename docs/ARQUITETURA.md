# Arquitetura

## Visão geral

Três processos, um banco:

```
          ┌──────────────┐        ┌──────────────┐
          │   web (SPA)  │  HTTP  │   backend    │
          │  React/Vite  │ <────> │  Express API │
          └──────────────┘        └──────┬───────┘
                                         │ Prisma
                                   ┌─────▼──────┐
                                   │   banco    │  (SQLite → Postgres)
                                   └─────▲──────┘
                                         │ Prisma
                                  ┌──────┴───────┐
                                  │    worker    │  cron real (não timer de página)
                                  │  poll Outlook│
                                  │  fila Gmail  │
                                  └──────┬───────┘
                            Gmail API ◄──┘──► Microsoft Graph
```

- **backend**: fonte única de verdade. Expõe a API que o painel consome.
  O frontend nunca fala com Gmail/Graph diretamente — só lê dados já processados.
  Isso elimina o "tremendo" (re-render/piscar): a tela lê estado estável do banco.
- **worker**: roda separado e continua funcionando com o painel fechado.
  Faz o poll do Outlook e processa a fila de envio do Gmail (10 msg / 5 min,
  retentativas, pausa em erros repetidos).
- **banco**: SQLite para começar (sem custo, sem config). Migrável a PostgreSQL
  trocando `provider`/`DATABASE_URL` — recomendado quando backend e worker rodarem
  em máquinas separadas (melhor concorrência).

## Por que o envio nunca é automático

A IA/sistema apenas **prepara** mensagens (estado `RASCUNHO`/`AGUARDANDO_APROVACAO`).
Só saem da fila itens `APROVADA`, após ação explícita do administrador. Um item só
vira "enviado" quando o Gmail devolve um `Message-ID` real (`ACEITA_API`) — e isso
não é prometido como "entregue", apenas aceito pela API.

## Vinculação de respostas (anti-erro)

Uma resposta recebida no Outlook é ligada ao protocolo original por, em ordem:

1. `In-Reply-To` / `References` → `Message-ID` de uma mensagem OUTBOUND (confiança ALTA).
2. Número de protocolo no assunto + remetente conhecido (confiança MÉDIA).
3. Indícios fracos → confiança BAIXA → **conferência humana**, sem criar solicitação.

## Fluxo da Secretaria (aba Fila)

```
PEDIDO REAL → ENVIO (Gmail) → RESPOSTA (Outlook) → ANÁLISE
   → CORREÇÃO (se necessária) → PROCEDIMENTO → CONCLUSÃO
```

Sem IA ligada, "ANÁLISE" significa: vincular ao protocolo, anexar documentos e
apresentar ao administrador decidir. Com Gemini ligado (futuro), a análise de
pendências/documentos passa a ser sugerida automaticamente — o envio continua
dependendo de aprovação.
