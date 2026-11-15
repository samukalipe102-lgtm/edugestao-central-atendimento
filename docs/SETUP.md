# Instalação e execução

## Pré-requisitos

- Node.js 22+

## Passo a passo (desenvolvimento)

```bash
# 1. Instalar dependências (monorepo)
npm install

# 2. Configurar variáveis de ambiente do backend
cp packages/backend/.env.example packages/backend/.env
#   edite packages/backend/.env conforme necessário

# 3. Criar o banco (SQLite) e gerar o client
npm run db:generate -w packages/backend
npm run db:migrate -w packages/backend

# 4. Criar o administrador inicial
cd packages/backend
npx tsx src/scripts/createAdmin.ts seu-email@exemplo.com "Seu Nome" "SuaSenhaForte"
cd ../..

# 5. Rodar os três processos (em terminais separados)
npm run dev -w packages/backend   # API em http://localhost:4000
npm run dev -w packages/worker    # worker de segundo plano
npm run dev -w packages/web       # painel em http://localhost:5173
```

Acesse `http://localhost:5173`, faça login e vá em **Integrações** para conectar
o Gmail e o Outlook (veja os guias abaixo).

## Produção (resumo)

- Compile tudo: `npm run build`
- Rode `node packages/backend/dist/index.js` e `node packages/worker/dist/index.js`
  como serviços persistentes (systemd, PM2, container, etc.).
- Sirva `packages/web/dist` como estático atrás do mesmo domínio da API (ou ajuste CORS).
- Para produção, defina `TOKEN_ENCRYPTION_KEY` (cifra os tokens OAuth em repouso)
  e um `JWT_SECRET` forte. Para múltiplas instâncias, migre o banco para PostgreSQL.
