'use client';

import { Header } from '@/components/dashboard/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BookOpen,
  Linkedin,
  Sparkles,
  CalendarDays,
  Trophy,
  BarChart3,
  Zap,
  Settings,
  PlayCircle,
} from 'lucide-react';

const tutorialSections = [
  {
    title: 'Primeiros Passos',
    description: 'Como começar na plataforma',
    icon: PlayCircle,
    items: [
      'Como acessar sua conta',
      'Como conectar seu LinkedIn',
      'Configurar seu perfil e branding pessoal',
    ],
  },
  {
    title: 'Trilhas de Capacitação',
    description: 'Aprenda e evolua',
    icon: BookOpen,
    items: [
      'Como iniciar uma trilha',
      'Como completar módulos e quizzes',
      'Pontuação e progresso',
    ],
  },
  {
    title: 'Assistente de Conteúdo',
    description: 'Crie posts com IA',
    icon: Sparkles,
    items: [
      'Como gerar uma legenda',
      'Usando temas em alta como inspiração',
      'Formatos e tamanhos de post',
    ],
  },
  {
    title: 'Calendário Editorial',
    description: 'Agende e publique',
    icon: CalendarDays,
    items: [
      'Como agendar um post',
      'Como publicar direto no LinkedIn',
      'Adicionar imagens ao post',
    ],
  },
  {
    title: 'LinkedIn Feed',
    description: 'Acompanhe os posts',
    icon: Linkedin,
    items: [
      'Como ver posts dos colegas',
      'Métricas de engajamento',
    ],
  },
  {
    title: 'Missões',
    description: 'Desafios semanais',
    icon: Zap,
    items: [
      'Como completar missões',
      'Tipos de missões disponíveis',
      'Recompensas por missões',
    ],
  },
  {
    title: 'Rankings & Recompensas',
    description: 'Gamificação',
    icon: Trophy,
    items: [
      'Como funciona o ranking',
      'Como resgatar recompensas',
      'Sistema de pontuação',
    ],
  },
  {
    title: 'Configurações',
    description: 'Personalize sua experiência',
    icon: Settings,
    items: [
      'Editar branding pessoal',
      'Reconectar LinkedIn',
      'Alterar dados do perfil',
    ],
  },
];

export function SuportePageContent() {
  return (
    <>
      <Header title="Central de Suporte" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {/* Header banner */}
        <div className="rounded-xl bg-gradient-to-r from-purple-50 to-purple-100/50 border border-purple-200/50 p-6">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-6 w-6 text-purple-600" />
            <h2 className="text-xl font-bold text-foreground">Como usar a Boldfy</h2>
            <Badge variant="outline" className="text-[10px] border-purple-200 text-purple-600">
              Em construção
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Tutoriais e guias para aproveitar ao máximo a plataforma.
            Estamos construindo essa documentação — em breve cada tópico terá um tutorial completo.
          </p>
        </div>

        {/* Tutorial cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tutorialSections.map((section) => (
            <Card key={section.title} className="opacity-80 hover:opacity-100 transition-opacity">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                    <section.icon className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">{section.title}</CardTitle>
                    <CardDescription className="text-xs">{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {section.items.map((item) => (
                    <li key={item} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="text-purple-300 mt-0.5">●</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
