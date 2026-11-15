# App desktop — EduGestão Central de Atendimento

Empacota toda a central (API + worker de segundo plano + painel) num app Windows
instalável (Electron). O worker roda **enquanto o app está aberto**: ao abrir, o
acompanhamento do recebimento e a fila de envio ligam; ao fechar, pausam. O estado
fica no banco, então nada se perde entre sessões.

## Onde ficam os dados e as credenciais

- **Banco (SQLite) e tokens OAuth:** pasta `data/` dentro de `userData` do app
  (ex.: `%APPDATA%/EduGestão Central de Atendimento/data/`). Fora do executável.
- **Credenciais** (Client ID/Secret do Google, chave de IA, segredos):
  `userData/config.json`. Nunca embutidas no `.exe`, nunca versionadas.

Configure pelo menu **Arquivo → Configurar credenciais…** na primeira execução.

## Build do instalador (.exe)

Feito via GitHub Actions (runner Windows), como no repositório salavirtualedugestao:

1. Crie e envie uma tag: `git tag v0.1.0 && git push origin v0.1.0`.
2. O workflow `desktop-build.yml` gera o instalador **NSIS** + versão **portátil**
   e anexa ao Release.

### Build local (em uma máquina Windows)

```bash
# na raiz do monorepo
npm ci
npm run build -w packages/shared
npm run build -w packages/backend
npm run build -w packages/web
npx prisma generate --schema packages/backend/prisma/schema.prisma

cd desktop
npm install
npm run dist:win   # gera desktop/release/*.exe
```

## Redirect URIs do Google (app desktop)

O backend sobe na porta local **47620**. Cadastre no Google Cloud (Credenciais OAuth):

- `http://localhost:47620/api/integrations/gmail-send/callback`
- `http://localhost:47620/api/integrations/gmail-recv/callback`

## Executar em desenvolvimento

```bash
cd desktop
npm install
npm start   # sobe o app apontando para os builds do monorepo
```
