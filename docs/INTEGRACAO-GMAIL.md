# Conectar o Gmail (conta de ENVIO)

Conta: **secretariaedugestao@gmail.com**. Usada só para enviar.

> Faça este processo logado na conta `secretariaedugestao@gmail.com` (ou com ela
> adicionada como usuário de teste).

## 1. Criar o projeto no Google Cloud

1. Acesse https://console.cloud.google.com/
2. No topo, crie um projeto (ex.: "EduGestão Central").

## 2. Ativar a Gmail API

1. Menu → **APIs e serviços** → **Biblioteca**.
2. Procure **Gmail API** → **Ativar**.

## 3. Tela de consentimento OAuth

1. **APIs e serviços** → **Tela de permissão OAuth**.
2. Tipo de usuário: **Externo** → Criar.
3. Preencha nome do app, e-mail de suporte e e-mail do desenvolvedor.
4. Em **Usuários de teste**, adicione `secretariaedugestao@gmail.com`.
   (Enquanto o app estiver em "Teste", só contas listadas aqui funcionam, e o
   refresh token pode expirar em 7 dias — para uso contínuo, publique o app.)
5. Escopo necessário: `https://www.googleapis.com/auth/gmail.send`.

## 4. Criar as credenciais OAuth

1. **APIs e serviços** → **Credenciais** → **Criar credenciais** → **ID do cliente OAuth**.
2. Tipo: **Aplicativo da Web**.
3. Em **URIs de redirecionamento autorizados**, adicione exatamente:
   - Desenvolvimento: `http://localhost:4000/api/integrations/gmail/callback`
   - Produção: `https://SEU_DOMINIO/api/integrations/gmail/callback`
4. Copie o **Client ID** e o **Client Secret**.

## 5. Configurar no servidor

No `packages/backend/.env`:

```
GMAIL_CLIENT_ID="...apps.googleusercontent.com"
GMAIL_CLIENT_SECRET="..."
GMAIL_REDIRECT_URI="http://localhost:4000/api/integrations/gmail/callback"
```

Reinicie o backend.

## 6. Conectar e testar no painel

1. Painel → **Integrações** → Gmail → **Conectar**.
2. Autorize na janela do Google.
3. Clique em **Testar conexão**. Deve mostrar "Conexão OK: secretariaedugestao@gmail.com".

Só depois de o teste passar o envio real está disponível.
