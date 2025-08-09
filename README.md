# Boldfy - Plataforma de Gamificação

Bem-vindo à sua nova plataforma de gamificação para embaixadores de marca. Este guia irá ajudá-lo a configurar o primeiro usuário (Master) para que você possa começar a adicionar empresas clientes.

## Como Iniciar e Definir o Usuário Master

Para que a aplicação funcione corretamente e você possa começar a adicionar empresas clientes, o primeiro passo é criar o usuário **Master**. Este usuário é o superadministrador da plataforma.

A criação do usuário Master é um processo manual e seguro, feito em duas etapas diretamente no seu console do Firebase.

### 1. Criar a Autenticação do Usuário

Vá para o seu console do Firebase:

1.  Selecione o seu projeto (`boldfy-app`).
2.  No menu à esquerda, vá para **Authentication**.
3.  Clique no botão **Adicionar usuário**.
4.  Digite o e-mail que você deseja para o seu usuário Master (ex: `clara@boldfy.com.br`).
5.  Crie uma senha forte.
6.  Clique em **Adicionar usuário**.

Após adicionar, você verá o usuário na lista. **Copie o UID do usuário** que você acabou de criar (ele se parece com algo como `aBCdEfgHiJkLmNoPqRsTuVwXyZ1`).

### 2. Criar o Documento do Usuário no Firestore

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

**Pronto!** Seu usuário Master está criado. Agora você pode ir para a página de login da sua aplicação, usar o e-mail e a senha que você cadastrou, e você será direcionado para o Master Dashboard, de onde poderá começar a adicionar suas empresas clientes.
