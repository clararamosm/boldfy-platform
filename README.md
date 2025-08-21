# Boldfy - Plataforma de Gamificação para Embaixadores de Marca

Bem-vindo à sua nova plataforma de gamificação. Este guia irá ajudá-lo a configurar o ambiente de produção, definir o primeiro usuário (Master) e garantir que tudo funcione perfeitamente.

---

## 🚀 O Que Fazer Após a Publicação

Depois que sua aplicação for publicada, siga estes 3 passos essenciais para torná-la operacional.

### 1. Definir o Usuário Master (Super Admin)

Para que você possa gerenciar a plataforma e adicionar empresas, o primeiro passo é criar seu próprio usuário **Master**. Este é um processo manual e seguro, feito diretamente no seu console do Firebase.

#### Etapa A: Criar o Usuário na Autenticação

1.  Vá para o seu console do Firebase e selecione seu projeto.
2.  No menu à esquerda, vá para **Authentication**.
3.  Clique em **Adicionar usuário**.
4.  Digite o e-mail que você usará como superadministrador (ex: `seu-email@sua-empresa.com`).
5.  Crie uma senha forte e segura.
6.  Clique em **Adicionar usuário**.

Após adicionar, você verá o usuário na lista. **Copie o UID** dele (um código longo de letras e números).

#### Etapa B: Atribuir o Perfil Master no Banco de Dados

1.  Ainda no console do Firebase, vá para **Cloud Firestore** no menu à esquerda.
2.  Se a coleção `users` não existir, clique em **Iniciar coleção** e nomeie-a como `users`.
3.  Dentro da coleção `users`, clique em **Adicionar documento**.
4.  No campo "ID do documento", **cole o UID** que você copiou na etapa anterior.
5.  Adicione o seguinte campo ao documento:
    *   **Campo**: `role`
    *   **Tipo**: `string`
    *   **Valor**: `master`
6.  Clique em **Salvar**.

**Pronto!** Seu usuário Master está criado. Agora você pode ir para a página de login da sua aplicação, usar o e-mail e a senha que cadastrou, e será direcionado ao Master Dashboard.

---

### 2. Configurar o Webhook do Stripe em Produção

Para que as assinaturas e ativações de empresas funcionem automaticamente após o pagamento, você precisa configurar o webhook do Stripe.

1.  Vá para o seu **Dashboard do Stripe**.
2.  No menu, vá para **Desenvolvedores > Webhooks**.
3.  Clique em **Adicionar um endpoint**.
4.  No campo **URL do endpoint**, cole a URL da sua aplicação publicada, seguida por `/api/stripe/webhook`.
    *   Exemplo: `https://seusite.com/api/stripe/webhook`
5.  Em **Selecionar eventos**, escolha o evento `checkout.session.completed`.
6.  Clique em **Adicionar endpoint**.
7.  Após criar, o Stripe lhe dará uma **chave secreta do webhook** (começa com `whsec_...`). Copie essa chave.
8.  Adicione essa chave ao seu arquivo `.env` como `STRIPE_WEBHOOK_SECRET` e faça um novo deploy da sua aplicação para que a alteração tenha efeito.

---

### 3. Verificar a API de IA (Genkit)

O Assistente de Conteúdo de IA usa a API Vertex AI do Google Cloud. O Firebase geralmente a ativa para você durante o deploy, mas é bom confirmar.

1.  Acesse o [Console do Google Cloud](https://console.cloud.google.com/).
2.  Certifique-se de que o projeto selecionado é o seu do Firebase.
3.  Na barra de busca, procure por **"Vertex AI API"**.
4.  Na página da API, se ela não estiver ativa, clique em **Ativar**.

Com esses três passos concluídos, sua plataforma estará pronta para operar e receber seus primeiros clientes.
