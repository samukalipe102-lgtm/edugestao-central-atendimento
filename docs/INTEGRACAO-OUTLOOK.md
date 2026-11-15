# Conectar o Outlook (conta de RECEBIMENTO)

Conta: **admsedugestao@outlook.com**. Usada só para receber respostas.

Conta pessoal `@outlook.com` → o registro usa o endpoint "consumers" da Microsoft.

## 1. Registrar o app no portal Azure / Entra

1. Acesse https://entra.microsoft.com/ (ou https://portal.azure.com → "Microsoft Entra ID").
   Pode entrar com a própria conta `admsedugestao@outlook.com`.
2. Menu → **Aplicativos** → **Registros de aplicativo** → **Novo registro**.
3. Nome: `EduGestão Central`.
4. **Tipos de conta com suporte:** escolha
   **"Contas em qualquer diretório organizacional e contas pessoais da Microsoft"**
   (isso habilita contas `@outlook.com`).
5. **URI de redirecionamento:** plataforma **Web**, com:
   - Desenvolvimento: `http://localhost:4000/api/integrations/outlook/callback`
   - Produção: `https://SEU_DOMINIO/api/integrations/outlook/callback`
6. Registrar. Anote o **ID do aplicativo (cliente)**.

## 2. Criar um segredo do cliente

1. No app registrado → **Certificados e segredos** → **Novo segredo do cliente**.
2. Descrição e validade → Adicionar.
3. Copie o **Valor** do segredo imediatamente (só aparece uma vez).

## 3. Permissões de API

1. **Permissões de API** → **Adicionar permissão** → **Microsoft Graph** →
   **Permissões delegadas**.
2. Adicione: `User.Read`, `Mail.Read`, `offline_access`.
3. (Conta pessoal não exige consentimento de administrador.)

## 4. Configurar no servidor

No `packages/backend/.env`:

```
MS_CLIENT_ID="..."
MS_CLIENT_SECRET="...(o Valor do segredo)"
MS_TENANT="consumers"
MS_REDIRECT_URI="http://localhost:4000/api/integrations/outlook/callback"
```

Reinicie o backend.

## 5. Conectar e testar no painel

1. Painel → **Integrações** → Outlook → **Conectar**.
2. Entre com `admsedugestao@outlook.com` e autorize.
3. Clique em **Testar conexão**. Deve mostrar "Conexão OK: admsedugestao@outlook.com".

## Observação importante sobre contas pessoais

Contas `@outlook.com` têm recursos de Graph mais limitados que contas corporativas
Microsoft 365. A leitura da caixa de entrada (`Mail.Read`) funciona; recursos
avançados (webhooks/subscriptions de longa duração) podem ter restrições. Por isso
o sistema faz **polling** periódico (worker), que funciona sem webhook.
