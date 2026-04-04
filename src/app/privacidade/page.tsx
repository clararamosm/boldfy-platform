// src/app/privacidade/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidade — Boldfy',
  description: 'Política de Privacidade da plataforma Boldfy.',
};

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-primary">
            Boldfy
          </Link>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground mb-10">
          Última atualização: 4 de abril de 2026
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introdução</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A Boldfy (&quot;nós&quot;, &quot;nosso&quot; ou &quot;plataforma&quot;) tem o compromisso
              de proteger a privacidade dos seus usuários. Esta Política de Privacidade descreve como
              coletamos, usamos, armazenamos e compartilhamos suas informações pessoais quando você
              utiliza nossa plataforma de employee advocacy e engajamento gamificado.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">2. Dados que coletamos</h2>
            <p className="text-sm leading-relaxed text-muted-foreground mb-3">
              Coletamos os seguintes tipos de informações:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">Dados de cadastro:</strong> nome, e-mail, cargo
                e empresa, fornecidos pelo administrador da sua organização ao convidá-lo para a plataforma.
              </li>
              <li>
                <strong className="text-foreground">Dados do LinkedIn:</strong> ao conectar sua conta,
                acessamos seu nome, foto de perfil, e-mail e ID do LinkedIn via OAuth 2.0. Utilizamos
                o scope <code className="bg-muted px-1 rounded text-xs">w_member_social</code> para
                publicar conteúdo em seu nome, somente com sua autorização explícita.
              </li>
              <li>
                <strong className="text-foreground">Conteúdo criado:</strong> textos, imagens e
                agendamentos de posts que você cria na plataforma.
              </li>
              <li>
                <strong className="text-foreground">Métricas de engajamento:</strong> dados públicos
                de reações e comentários dos posts publicados através da plataforma.
              </li>
              <li>
                <strong className="text-foreground">Dados de uso:</strong> informações sobre como
                você interage com a plataforma (páginas visitadas, funcionalidades utilizadas).
              </li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">3. Como usamos seus dados</h2>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              <li>Publicar conteúdo no LinkedIn em seu nome, apenas quando você solicitar.</li>
              <li>Exibir métricas de desempenho dos seus posts no dashboard.</li>
              <li>Personalizar a geração de conteúdo com IA baseada no seu tom de voz e expertise.</li>
              <li>Gerenciar o sistema de gamificação (pontos, rankings, missões e recompensas).</li>
              <li>Enviar notificações sobre conteúdos, missões e atualizações da plataforma.</li>
              <li>Melhorar a experiência do usuário e desenvolver novos recursos.</li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">4. Integração com o LinkedIn</h2>
            <p className="text-sm leading-relaxed text-muted-foreground mb-3">
              A conexão com o LinkedIn é opcional e pode ser desfeita a qualquer momento nas
              Configurações. Ao conectar:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              <li>Armazenamos seu token de acesso de forma segura para publicar em seu nome.</li>
              <li>
                <strong className="text-foreground">Nunca</strong> publicamos nada sem sua ação
                explícita (clicar em &quot;Publicar&quot; ou agendar um post).
              </li>
              <li>
                <strong className="text-foreground">Nunca</strong> acessamos suas mensagens, conexões
                ou dados privados do LinkedIn.
              </li>
              <li>Só acessamos métricas de posts publicados pela plataforma Boldfy.</li>
              <li>
                Ao desconectar, removemos seu token de acesso e dados de conexão imediatamente.
              </li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">5. Armazenamento e segurança</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Seus dados são armazenados no Google Firebase (Firestore e Firebase Storage), com
              servidores localizados nos Estados Unidos. Utilizamos regras de segurança do Firestore
              para garantir que cada usuário acesse apenas seus próprios dados. Tokens de acesso do
              LinkedIn são armazenados de forma criptografada e nunca são expostos ao navegador do
              cliente.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">6. Compartilhamento de dados</h2>
            <p className="text-sm leading-relaxed text-muted-foreground mb-3">
              Não vendemos seus dados pessoais. Compartilhamos informações apenas nos seguintes casos:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">Com o administrador da sua empresa:</strong> nome,
                pontuação, ranking e métricas agregadas de posts.
              </li>
              <li>
                <strong className="text-foreground">Com o LinkedIn:</strong> conteúdo que você
                solicitar que seja publicado.
              </li>
              <li>
                <strong className="text-foreground">Provedores de serviço:</strong> Google (Firebase,
                hosting), Stripe (pagamentos), OpenAI/Google AI (geração de conteúdo — sem dados
                pessoais identificáveis).
              </li>
              <li>
                <strong className="text-foreground">Obrigação legal:</strong> quando exigido por lei
                ou ordem judicial.
              </li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">7. Seus direitos</h2>
            <p className="text-sm leading-relaxed text-muted-foreground mb-3">
              Em conformidade com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              <li>Acessar seus dados pessoais armazenados na plataforma.</li>
              <li>Corrigir dados incorretos ou desatualizados.</li>
              <li>Solicitar a exclusão dos seus dados (direito ao esquecimento).</li>
              <li>Revogar o consentimento para uso dos dados a qualquer momento.</li>
              <li>Desconectar sua conta do LinkedIn a qualquer momento nas Configurações.</li>
              <li>Solicitar portabilidade dos seus dados.</li>
            </ul>
            <p className="text-sm leading-relaxed text-muted-foreground mt-3">
              Para exercer qualquer desses direitos, entre em contato pelo e-mail{' '}
              <a href="mailto:contato@boldfy.com.br" className="text-primary hover:underline">
                contato@boldfy.com.br
              </a>.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">8. Cookies e rastreamento</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Utilizamos cookies essenciais para manter sua sessão autenticada. Não utilizamos
              cookies de rastreamento de terceiros ou publicidade. Poderemos utilizar ferramentas
              de analytics no futuro, e esta política será atualizada caso isso ocorra.
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">9. Retenção de dados</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Mantemos seus dados enquanto sua conta estiver ativa na plataforma. Ao solicitar
              exclusão, removemos seus dados pessoais em até 30 dias. Posts já publicados no LinkedIn
              permanecem na rede social e devem ser removidos diretamente por você no LinkedIn.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">10. Alterações nesta política</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos os
              usuários sobre mudanças significativas por e-mail ou por meio de um aviso na plataforma.
              Recomendamos que você revise esta página periodicamente.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">11. Contato</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Se você tiver dúvidas sobre esta Política de Privacidade ou sobre o tratamento dos
              seus dados, entre em contato conosco:
            </p>
            <div className="mt-3 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground space-y-1">
              <p><strong className="text-foreground">Boldfy</strong></p>
              <p>E-mail: <a href="mailto:contato@boldfy.com.br" className="text-primary hover:underline">contato@boldfy.com.br</a></p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="mx-auto max-w-3xl px-6 py-6 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Boldfy. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
