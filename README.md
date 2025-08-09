# Boldfy - Plataforma de Gamificação

Bem-vindo à sua nova plataforma de gamificação para embaixadores de marca. Este guia irá ajudá-lo a configurar o primeiro usuário (Master) para que você possa começar a adicionar empresas clientes.

## Configuração do Ambiente

Antes de iniciar, certifique-se de que o arquivo `.env` na raiz do projeto está preenchido com as suas chaves do Stripe.

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## 1. Como Definir o Usuário Master

Para que a aplicação funcione e você possa adicionar empresas, o primeiro passo é criar o usuário **Master**. Este é o superadministrador da plataforma. A criação é um processo manual e seguro, feito em duas etapas no seu console do Firebase.

### 1.1 Criar a Autenticação do Usuário

Vá para o seu console do Firebase:

1.  Selecione o seu projeto (`boldfy-app`).
2.  No menu à esquerda, vá para **Authentication**.
3.  Clique em **Adicionar usuário**.
4.  Digite o e-mail que você deseja para o seu usuário Master (ex: `clara@boldfy.com.br`).
5.  Crie uma senha forte.
6.  Clique em **Adicionar usuário**.

Após adicionar, você verá o usuário na lista. **Copie o UID do usuário** que você acabou de criar (ele se parece com algo como `aBCdEfgHiJkLmNoPqRsTuVwXyZ1`).

### 1.2 Criar o Documento do Usuário no Firestore

Agora, vamos atribuir o perfil "master" a este usuário no banco de dados.

1.  No menu à esquerda do Firebase, vá para **Cloud Firestore**.
2.  Na parte superior, clique em **Iniciar coleção**.
3.  No campo "ID da coleção", digite `users`.
4.  Clique em **Próximo**.
5.  No campo "ID do documento", **cole o UID** que você copiou da etapa de autenticação.
6.  Adicione o primeiro campo ao documento:
    *   **Campo**: `role`
    *   **Tipo**: `string`
    *   **Valor**: `master`
7.  Clique em **Salvar**.

**Pronto!** Seu usuário Master está criado. Agora você pode ir para a página de login da sua aplicação, usar o e-mail e a senha que você cadastrou, e você será direcionado para o Master Dashboard.

## 2. Configurar o Webhook do Stripe

Para que a criação de novas empresas funcione automaticamente após o pagamento, você precisa configurar um webhook no Stripe.

1.  Inicie a aplicação localmente (`npm run dev`).
2.  Inicie o **Stripe CLI** para encaminhar os eventos do webhook para a sua máquina local:
    ```bash
    stripe listen --forward-to localhost:9002/api/stripe/webhook
    ```
3.  O CLI irá fornecer uma **chave secreta do webhook** (algo como `whsec_...`). Copie essa chave e cole no seu arquivo `.env` como `STRIPE_WEBHOOK_SECRET`.
4.  No seu **Dashboard do Stripe**, vá para a seção de Desenvolvedores > Webhooks.
5.  Clique em **Adicionar um endpoint**.
6.  Para a **URL do endpoint**, em um ambiente de produção, será o URL da sua aplicação (`https://SUA_APP.com/api/stripe/webhook`). Para testes locais, você usará o túnel do Stripe.
7.  Selecione o evento `checkout.session.completed`.
8.  Clique em **Adicionar endpoint**.

Agora, sempre que um pagamento for concluído, o Stripe enviará um evento para sua aplicação, que ativará a empresa e criará a conta do admin automaticamente.
