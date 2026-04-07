'use client';

import Link from 'next/link';
import { PublicLocaleWrapper } from '@/components/public-locale-wrapper';
import { LanguageToggle } from '@/components/language-toggle';
import type { Locale } from '@/lib/i18n/types';

export default function PrivacidadePage() {
  return (
    <PublicLocaleWrapper>
      {(locale, setLocale) => <PrivacidadeContent locale={locale} setLocale={setLocale} />}
    </PublicLocaleWrapper>
  );
}

function PrivacidadeContent({ locale, setLocale }: { locale: Locale; setLocale: (l: Locale) => void }) {
  const isEN = locale === 'en';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-primary">
            Boldfy
          </Link>
          <div className="flex items-center gap-3">
            <LanguageToggle locale={locale} onChange={setLocale} />
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isEN ? 'Log in' : 'Entrar'}
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {isEN ? 'Privacy Policy' : 'Pol\u00edtica de Privacidade'}
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          {isEN ? 'Last updated: April 4, 2026' : '\u00daltima atualiza\u00e7\u00e3o: 4 de abril de 2026'}
        </p>

        {isEN && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 mb-10 text-sm text-amber-800 dark:text-amber-200">
            This is a courtesy translation. The Portuguese version is the legally binding document.
          </div>
        )}

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              {isEN ? '1. Introduction' : '1. Introdu\u00e7\u00e3o'}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {isEN
                ? 'Boldfy ("we", "us", or "platform") is committed to protecting the privacy of its users. This Privacy Policy describes how we collect, use, store, and share your personal information when you use our employee advocacy and gamified engagement platform.'
                : 'A Boldfy ("n\u00f3s", "nosso" ou "plataforma") tem o compromisso de proteger a privacidade dos seus usu\u00e1rios. Esta Pol\u00edtica de Privacidade descreve como coletamos, usamos, armazenamos e compartilhamos suas informa\u00e7\u00f5es pessoais quando voc\u00ea utiliza nossa plataforma de employee advocacy e engajamento gamificado.'}
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              {isEN ? '2. Data we collect' : '2. Dados que coletamos'}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground mb-3">
              {isEN
                ? 'We collect the following types of information:'
                : 'Coletamos os seguintes tipos de informa\u00e7\u00f5es:'}
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">
                  {isEN ? 'Registration data:' : 'Dados de cadastro:'}
                </strong>{' '}
                {isEN
                  ? 'name, email, job title, and company, provided by your organization\u2019s administrator when inviting you to the platform.'
                  : 'nome, e-mail, cargo e empresa, fornecidos pelo administrador da sua organiza\u00e7\u00e3o ao convid\u00e1-lo para a plataforma.'}
              </li>
              <li>
                <strong className="text-foreground">
                  {isEN ? 'LinkedIn data:' : 'Dados do LinkedIn:'}
                </strong>{' '}
                {isEN
                  ? 'when you connect your account, we access your name, profile picture, email, and LinkedIn ID via OAuth 2.0. We use the scope'
                  : 'ao conectar sua conta, acessamos seu nome, foto de perfil, e-mail e ID do LinkedIn via OAuth 2.0. Utilizamos o scope'}{' '}
                <code className="bg-muted px-1 rounded text-xs">w_member_social</code>{' '}
                {isEN
                  ? 'to publish content on your behalf, only with your explicit authorization.'
                  : 'para publicar conte\u00fado em seu nome, somente com sua autoriza\u00e7\u00e3o expl\u00edcita.'}
              </li>
              <li>
                <strong className="text-foreground">
                  {isEN ? 'Created content:' : 'Conte\u00fado criado:'}
                </strong>{' '}
                {isEN
                  ? 'text, images, and post schedules that you create on the platform.'
                  : 'textos, imagens e agendamentos de posts que voc\u00ea cria na plataforma.'}
              </li>
              <li>
                <strong className="text-foreground">
                  {isEN ? 'Engagement metrics:' : 'M\u00e9tricas de engajamento:'}
                </strong>{' '}
                {isEN
                  ? 'public data on reactions and comments from posts published through the platform.'
                  : 'dados p\u00fablicos de rea\u00e7\u00f5es e coment\u00e1rios dos posts publicados atrav\u00e9s da plataforma.'}
              </li>
              <li>
                <strong className="text-foreground">
                  {isEN ? 'Usage data:' : 'Dados de uso:'}
                </strong>{' '}
                {isEN
                  ? 'information about how you interact with the platform (pages visited, features used).'
                  : 'informa\u00e7\u00f5es sobre como voc\u00ea interage com a plataforma (p\u00e1ginas visitadas, funcionalidades utilizadas).'}
              </li>
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              {isEN ? '3. How we use your data' : '3. Como usamos seus dados'}
            </h2>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              <li>
                {isEN
                  ? 'Publish content on LinkedIn on your behalf, only when you request it.'
                  : 'Publicar conte\u00fado no LinkedIn em seu nome, apenas quando voc\u00ea solicitar.'}
              </li>
              <li>
                {isEN
                  ? 'Display performance metrics for your posts on the dashboard.'
                  : 'Exibir m\u00e9tricas de desempenho dos seus posts no dashboard.'}
              </li>
              <li>
                {isEN
                  ? 'Personalize AI-generated content based on your tone of voice and expertise.'
                  : 'Personalizar a gera\u00e7\u00e3o de conte\u00fado com IA baseada no seu tom de voz e expertise.'}
              </li>
              <li>
                {isEN
                  ? 'Manage the gamification system (points, rankings, missions, and rewards).'
                  : 'Gerenciar o sistema de gamifica\u00e7\u00e3o (pontos, rankings, miss\u00f5es e recompensas).'}
              </li>
              <li>
                {isEN
                  ? 'Send notifications about content, missions, and platform updates.'
                  : 'Enviar notifica\u00e7\u00f5es sobre conte\u00fados, miss\u00f5es e atualiza\u00e7\u00f5es da plataforma.'}
              </li>
              <li>
                {isEN
                  ? 'Improve the user experience and develop new features.'
                  : 'Melhorar a experi\u00eancia do usu\u00e1rio e desenvolver novos recursos.'}
              </li>
            </ul>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              {isEN ? '4. LinkedIn integration' : '4. Integra\u00e7\u00e3o com o LinkedIn'}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground mb-3">
              {isEN
                ? 'The LinkedIn connection is optional and can be revoked at any time in Settings. When you connect:'
                : 'A conex\u00e3o com o LinkedIn \u00e9 opcional e pode ser desfeita a qualquer momento nas Configura\u00e7\u00f5es. Ao conectar:'}
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              <li>
                {isEN
                  ? 'We store your access token securely in order to publish on your behalf.'
                  : 'Armazenamos seu token de acesso de forma segura para publicar em seu nome.'}
              </li>
              <li>
                <strong className="text-foreground">
                  {isEN ? 'Never' : 'Nunca'}
                </strong>{' '}
                {isEN
                  ? 'do we publish anything without your explicit action (clicking "Publish" or scheduling a post).'
                  : 'publicamos nada sem sua a\u00e7\u00e3o expl\u00edcita (clicar em "Publicar" ou agendar um post).'}
              </li>
              <li>
                <strong className="text-foreground">
                  {isEN ? 'Never' : 'Nunca'}
                </strong>{' '}
                {isEN
                  ? 'do we access your messages, connections, or private LinkedIn data.'
                  : 'acessamos suas mensagens, conex\u00f5es ou dados privados do LinkedIn.'}
              </li>
              <li>
                {isEN
                  ? 'We only access metrics from posts published through the Boldfy platform.'
                  : 'S\u00f3 acessamos m\u00e9tricas de posts publicados pela plataforma Boldfy.'}
              </li>
              <li>
                {isEN
                  ? 'Upon disconnecting, we immediately remove your access token and connection data.'
                  : 'Ao desconectar, removemos seu token de acesso e dados de conex\u00e3o imediatamente.'}
              </li>
            </ul>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              {isEN ? '5. Storage and security' : '5. Armazenamento e seguran\u00e7a'}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {isEN
                ? 'Your data is stored on Google Firebase (Firestore and Firebase Storage), with servers located in the United States. We use Firestore security rules to ensure that each user can only access their own data. LinkedIn access tokens are stored in encrypted form and are never exposed to the client browser.'
                : 'Seus dados s\u00e3o armazenados no Google Firebase (Firestore e Firebase Storage), com servidores localizados nos Estados Unidos. Utilizamos regras de seguran\u00e7a do Firestore para garantir que cada usu\u00e1rio acesse apenas seus pr\u00f3prios dados. Tokens de acesso do LinkedIn s\u00e3o armazenados de forma criptografada e nunca s\u00e3o expostos ao navegador do cliente.'}
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              {isEN ? '6. Data sharing' : '6. Compartilhamento de dados'}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground mb-3">
              {isEN
                ? 'We do not sell your personal data. We share information only in the following cases:'
                : 'N\u00e3o vendemos seus dados pessoais. Compartilhamos informa\u00e7\u00f5es apenas nos seguintes casos:'}
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">
                  {isEN ? 'With your company administrator:' : 'Com o administrador da sua empresa:'}
                </strong>{' '}
                {isEN
                  ? 'name, score, ranking, and aggregated post metrics.'
                  : 'nome, pontua\u00e7\u00e3o, ranking e m\u00e9tricas agregadas de posts.'}
              </li>
              <li>
                <strong className="text-foreground">
                  {isEN ? 'With LinkedIn:' : 'Com o LinkedIn:'}
                </strong>{' '}
                {isEN
                  ? 'content that you request to be published.'
                  : 'conte\u00fado que voc\u00ea solicitar que seja publicado.'}
              </li>
              <li>
                <strong className="text-foreground">
                  {isEN ? 'Service providers:' : 'Provedores de servi\u00e7o:'}
                </strong>{' '}
                {isEN
                  ? 'Google (Firebase, hosting), Google AI (content generation \u2014 without personally identifiable data).'
                  : 'Google (Firebase, hosting), Google AI (gera\u00e7\u00e3o de conte\u00fado \u2014 sem dados pessoais identific\u00e1veis).'}
              </li>
              <li>
                <strong className="text-foreground">
                  {isEN ? 'Legal obligation:' : 'Obriga\u00e7\u00e3o legal:'}
                </strong>{' '}
                {isEN
                  ? 'when required by law or court order.'
                  : 'quando exigido por lei ou ordem judicial.'}
              </li>
            </ul>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              {isEN ? '7. Your rights' : '7. Seus direitos'}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground mb-3">
              {isEN
                ? 'In compliance with the Brazilian General Data Protection Law (LGPD), you have the right to:'
                : 'Em conformidade com a Lei Geral de Prote\u00e7\u00e3o de Dados (LGPD), voc\u00ea tem direito a:'}
            </p>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
              <li>
                {isEN
                  ? 'Access your personal data stored on the platform.'
                  : 'Acessar seus dados pessoais armazenados na plataforma.'}
              </li>
              <li>
                {isEN
                  ? 'Correct inaccurate or outdated data.'
                  : 'Corrigir dados incorretos ou desatualizados.'}
              </li>
              <li>
                {isEN
                  ? 'Request deletion of your data (right to erasure).'
                  : 'Solicitar a exclus\u00e3o dos seus dados (direito ao esquecimento).'}
              </li>
              <li>
                {isEN
                  ? 'Revoke consent for data usage at any time.'
                  : 'Revogar o consentimento para uso dos dados a qualquer momento.'}
              </li>
              <li>
                {isEN
                  ? 'Disconnect your LinkedIn account at any time in Settings.'
                  : 'Desconectar sua conta do LinkedIn a qualquer momento nas Configura\u00e7\u00f5es.'}
              </li>
              <li>
                {isEN
                  ? 'Request portability of your data.'
                  : 'Solicitar portabilidade dos seus dados.'}
              </li>
            </ul>
            <p className="text-sm leading-relaxed text-muted-foreground mt-3">
              {isEN
                ? 'To exercise any of these rights, please contact us at '
                : 'Para exercer qualquer desses direitos, entre em contato pelo e-mail '}
              <a href="mailto:contato@boldfy.com.br" className="text-primary hover:underline">
                contato@boldfy.com.br
              </a>.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              {isEN ? '8. Cookies and tracking' : '8. Cookies e rastreamento'}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {isEN
                ? 'We use essential cookies to maintain your authenticated session. We do not use third-party tracking or advertising cookies. We may use analytics tools in the future, in which case this policy will be updated accordingly.'
                : 'Utilizamos cookies essenciais para manter sua sess\u00e3o autenticada. N\u00e3o utilizamos cookies de rastreamento de terceiros ou publicidade. Poderemos utilizar ferramentas de analytics no futuro, e esta pol\u00edtica ser\u00e1 atualizada caso isso ocorra.'}
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              {isEN ? '9. Data retention' : '9. Reten\u00e7\u00e3o de dados'}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {isEN
                ? 'We retain your data for as long as your account is active on the platform. Upon request for deletion, we remove your personal data within 30 days. Posts already published on LinkedIn remain on the social network and must be removed directly by you on LinkedIn.'
                : 'Mantemos seus dados enquanto sua conta estiver ativa na plataforma. Ao solicitar exclus\u00e3o, removemos seus dados pessoais em at\u00e9 30 dias. Posts j\u00e1 publicados no LinkedIn permanecem na rede social e devem ser removidos diretamente por voc\u00ea no LinkedIn.'}
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              {isEN ? '10. Changes to this policy' : '10. Altera\u00e7\u00f5es nesta pol\u00edtica'}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {isEN
                ? 'We may update this Privacy Policy periodically. We will notify users of significant changes by email or through a notice on the platform. We recommend that you review this page periodically.'
                : 'Podemos atualizar esta Pol\u00edtica de Privacidade periodicamente. Notificaremos os usu\u00e1rios sobre mudan\u00e7as significativas por e-mail ou por meio de um aviso na plataforma. Recomendamos que voc\u00ea revise esta p\u00e1gina periodicamente.'}
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="text-xl font-semibold mb-3">
              {isEN ? '11. Contact' : '11. Contato'}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {isEN
                ? 'If you have any questions about this Privacy Policy or about the processing of your data, please contact us:'
                : 'Se voc\u00ea tiver d\u00favidas sobre esta Pol\u00edtica de Privacidade ou sobre o tratamento dos seus dados, entre em contato conosco:'}
            </p>
            <div className="mt-3 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground space-y-1">
              <p><strong className="text-foreground">Boldfy</strong></p>
              <p>{isEN ? 'Email: ' : 'E-mail: '}<a href="mailto:contato@boldfy.com.br" className="text-primary hover:underline">contato@boldfy.com.br</a></p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="mx-auto max-w-3xl px-6 py-6 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Boldfy.{' '}
          {isEN ? 'All rights reserved.' : 'Todos os direitos reservados.'}
        </div>
      </footer>
    </div>
  );
}
