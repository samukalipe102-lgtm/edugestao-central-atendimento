# Conectar as duas contas Gmail

O sistema usa **duas contas Gmail** (ambas gratuitas), com **um único app OAuth**
no Google Cloud:

- **Envio:** `secretariaedugestao@gmail.com` — escopo `gmail.send`
- **Recebimento:** `admsedugestao@gmail.com` — escopo `gmail.readonly`

Não há Outlook/Azure, nada pago.

## 1. Criar o projeto no Google Cloud

1. Acesse https://console.cloud.google.com/
2. Crie um projeto (ex.: "EduGestão Central").

## 2. Ativar a Gmail API

1. **APIs e serviços** → **Biblioteca** → procure **Gmail API** → **Ativar**.

## 3. Tela de consentimento OAuth

1. **APIs e serviços** → **Tela de permissão OAuth**.
2. Tipo de usuário: **Externo** → Criar.
3. Preencha nome do app e e-mails de contato.
4. Em **Usuários de teste**, adicione **as duas contas**:
   `secretariaedugestao@gmail.com` e `admsedugestao@gmail.com`.
   (Enquanto o app estiver em "Teste", só contas listadas funcionam e o refresh
   token pode expirar em 7 dias. Para uso contínuo, publique o app.)
5. Escopos usados: `gmail.send` e `gmail.readonly`.

## 4. Criar as credenciais OAuth

1. **APIs e serviços** → **Credenciais** → **Criar credenciais** → **ID do cliente OAuth**.
2. Tipo: **Aplicativo da Web**.
3. Em **URIs de redirecionamento autorizados**, adicione **os dois** (dev):
   - `http://localhost:4000/api/integrations/gmail-send/callback`
   - `http://localhost:4000/api/integrations/gmail-recv/callback`
   - (Em produção/app desktop os URIs usam a porta/host corretos — veja observação abaixo.)
4. Copie o **Client ID** e o **Client Secret** (servem para as duas contas).

## 5. Configurar no servidor

No `packages/backend/.env`:

```
GMAIL_CLIENT_ID="...apps.googleusercontent.com"
GMAIL_CLIENT_SECRET="..."
GMAIL_SEND_REDIRECT_URI="http://localhost:4000/api/integrations/gmail-send/callback"
GMAIL_RECV_REDIRECT_URI="http://localhost:4000/api/integrations/gmail-recv/callback"
```

Reinicie o backend.

## 6. Conectar e testar no painel

1. Painel → **Integrações**.
2. **Gmail — envio** → **Conectar** → entre com `secretariaedugestao@gmail.com` → autorize.
3. **Gmail — recebimento** → **Conectar** → entre com `admsedugestao@gmail.com` → autorize.
4. Em cada uma, clique **Testar conexão**. Deve mostrar o e-mail correto.

Só depois de o teste passar o envio/recebimento real fica disponível.

## Observação (app desktop)

No app empacotado, o backend sobe numa porta fixa local e os redirect URIs usam
essa porta. Os URIs exatos a cadastrar no Google Cloud estão documentados em
`desktop/README` (gerado no empacotamento). O fluxo de conectar/testar no painel
é o mesmo.
