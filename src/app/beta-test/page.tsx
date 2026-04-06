'use client';

import { useState } from 'react';
import { LogoFull } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { sendBetaLeadToNotion } from '@/app/actions/beta-leads';
import { Loader2, CheckCircle2, Calendar, ArrowRight, Megaphone, Target, Heart, Rocket, Skull } from 'lucide-react';
import Link from 'next/link';

const CALENDAR_URL = 'https://calendar.app.google/5Q1HDD2jZSkWa1DH6';

export default function BetaTestPage() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cargo, setCargo] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [setor, setSetor] = useState('');
  const [colaboradores, setColaboradores] = useState('');
  const [objetivoPrincipal, setObjetivoPrincipal] = useState('');
  const [comoConheceu, setComoConheceu] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const scrollToForm = () => {
    document.getElementById('form-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);

    const result = await sendBetaLeadToNotion({
      nome, email, telefone, cargo, empresa, setor,
      colaboradores, objetivoPrincipal, comoConheceu, observacoes,
    });

    if (result.success) {
      setSent(true);
    } else {
      setError(result.error || 'Erro ao enviar. Tente novamente.');
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
          <LogoFull height={24} />
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-secondary px-3 py-1 rounded-full">
              Pitch Sheet
            </span>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Entrar
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">

        {/* ═══ HERO ═══ */}
        <section className="rounded-2xl bg-gradient-to-br from-[#0F0A18] via-[#1A0E2E] to-[#2D1445] px-8 py-12 md:px-12 md:py-16 mt-6 mb-6 relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-56 h-56 bg-primary/20 rounded-full blur-3xl" />
          <p className="text-[11px] font-bold uppercase tracking-[.14em] text-primary mb-3 relative z-10">
            Employee Advocacy & Influência Corporativa
          </p>
          <h1 className="font-headline text-2xl md:text-3xl font-bold text-white leading-tight mb-4 relative z-10">
            O maior canal de aquisição da sua empresa<br />
            <span className="text-primary">já bate ponto todo dia.</span>
          </h1>
          <p className="text-sm text-white/50 leading-relaxed max-w-3xl relative z-10">
            Plataforma gamificada que transforma colaboradores em influenciadores corporativos.
            IA contextual + trilhas + recompensas. A gente constrói o programa com vocês — estratégia primeiro, execução pela plataforma.
          </p>
        </section>

        {/* ═══ QUOTES ═══ */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { initial: 'R', name: 'Renata', role: 'CMO', quote: 'Coloco dinheiro em Ads e o lead chega frio. A Company Page tá morta. Preciso de alcance que não dependa de budget.', gradient: 'from-primary to-primary/70' },
            { initial: 'F', name: 'Fernando', role: 'Head de Vendas', quote: '100 abordagens, 99 silêncios. Ninguém atende quem não tem reputação no feed.', gradient: 'from-primary/70 to-[#5E2A67]' },
            { initial: 'C', name: 'Camila', role: 'Head de People', quote: 'Perdemos candidatos pra concorrência porque eles parecem mais inovadores. Nossos talentos tão calados.', gradient: 'from-[#7E22CE] to-primary' },
            { initial: 'M', name: 'Marcelo', role: 'CEO', quote: 'A autoridade da marca depende só de mim. Se eu parar de postar, a marca some.', gradient: 'from-[#0F0A18] to-[#2D1445]' },
          ].map((q) => (
            <div key={q.initial} className="bg-card border rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${q.gradient} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
                  {q.initial}
                </div>
                <div>
                  <p className="text-[11px] font-bold text-accent-foreground">{q.name}</p>
                  <p className="text-[9px] text-muted-foreground">{q.role}</p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                &ldquo;{q.quote}&rdquo;
              </p>
            </div>
          ))}
        </section>

        {/* ═══ USE CASES ═══ */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {[
            { icon: <Megaphone className="w-4 h-4 text-primary" />, title: 'Marketing & Branding', pain: 'Company Page morta · CAC subindo', solution: 'Perfis pessoais com 10x mais alcance viram canais da marca. IA alinha tudo com o Brand Context.', tags: ['Amplificação orgânica', 'Remarketing', '-CAC'], border: 'border-l-primary' },
            { icon: <Target className="w-4 h-4 text-primary/70" />, title: 'Vendas & Social Selling', pain: 'Cold ignorado · Sem autoridade digital', solution: 'Vendedor constrói autoridade técnica no feed. Prospect já "conhece" antes da call.', tags: ['Quebra-gelo', 'Ciclo menor', 'Autoridade'], border: 'border-l-primary/70' },
            { icon: <Heart className="w-4 h-4 text-[#5E2A67]" />, title: 'RH & Employer Branding', pain: 'Talentos indo pra concorrência visível', solution: 'Colaboradores mostram como trabalham de verdade. Trilhas ensinam a documentar desafios técnicos.', tags: ['Atração de talentos', 'Cultura real', 'EGC'], border: 'border-l-[#5E2A67]' },
          ].map((uc) => (
            <div key={uc.title} className={`bg-card border rounded-xl p-4 border-l-[3px] ${uc.border}`}>
              <div className="mb-2">{uc.icon}</div>
              <h3 className="text-[12px] font-bold text-accent-foreground mb-1">{uc.title}</h3>
              <p className="text-[10px] text-primary/70 font-semibold mb-2">{uc.pain}</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed mb-3">
                <span className="font-semibold text-accent-foreground">Antídoto: </span>{uc.solution}
              </p>
              <div className="flex flex-wrap gap-1">
                {uc.tags.map((t) => (
                  <span key={t} className="text-[8px] font-semibold px-2 py-1 rounded-full bg-secondary text-secondary-foreground">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* ═══ TWO JOURNEYS ═══ */}
        <section className="border rounded-xl overflow-hidden mb-6">
          <div className="bg-[#5E2A67] px-6 py-3 flex items-center justify-between">
            <h3 className="font-headline text-sm font-bold text-white">Duas jornadas. Dois resultados.</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 bg-card">
            {/* Sem Boldfy */}
            <div className="p-5 md:border-r">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-border" /> Sem Boldfy
              </p>
              {[
                { when: 'Semana 1', what: 'Empolgação inicial', how: 'Líder manda "vamos postar no LinkedIn!" no grupo. 5 pessoas postam.' },
                { when: 'Mês 1', what: 'Sem direção nem desenvolvimento', how: 'Ninguém sabe o que escrever. Sem trilha, sem ensino, sem contexto de marca.' },
                { when: 'Mês 2-3', what: 'Sem ferramenta, sem motivo', how: 'Sem IA pra ajudar, sem recompensa, sem métrica. Todo mundo para.' },
              ].map((s, i) => (
                <div key={i} className="flex gap-3 mb-0">
                  <div className="flex flex-col items-center w-4 shrink-0">
                    <div className="w-[10px] h-[10px] rounded-full border-2 border-border bg-background shrink-0" />
                    <div className="w-[2px] flex-1 bg-border" />
                  </div>
                  <div className="pb-4">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{s.when}</p>
                    <p className="text-[11px] font-semibold text-accent-foreground">{s.what}</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{s.how}</p>
                  </div>
                </div>
              ))}
              <div className="flex gap-3">
                <div className="flex flex-col items-center w-4 shrink-0">
                  <div className="w-[10px] h-[10px] rounded-full border-2 border-border bg-background shrink-0" />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Mês 4+</p>
                  <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3 mt-1">
                    <Skull className="w-5 h-5 text-destructive/70 shrink-0" />
                    <p className="text-[10px] font-semibold text-destructive/80 leading-snug">
                      Programa morreu. Voo de galinha. Volta pro tráfego pago. CAC continua subindo.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Com Boldfy */}
            <div className="p-5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-accent-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" /> Com Boldfy
              </p>
              {[
                { when: 'Semana 1', what: 'Setup assistido + onboarding', how: 'Brand Context, trilhas ativas, loja de recompensas montada, time convidado.' },
                { when: 'Mês 1', what: 'Desenvolvimento + primeiros posts', how: 'Trilhas ensinam a criar conteúdo. IA + voz pessoal elimina a página em branco.' },
                { when: 'Mês 2-3', what: 'Ferramentas + dados + jogo', how: 'IA contextual, rankings e recompensas mantêm engajamento. Dashboard mostra impressões e valor em R$.' },
              ].map((s, i) => (
                <div key={i} className="flex gap-3 mb-0">
                  <div className="flex flex-col items-center w-4 shrink-0">
                    <div className="w-[10px] h-[10px] rounded-full border-2 border-primary bg-secondary shrink-0" />
                    <div className="w-[2px] flex-1 bg-gradient-to-b from-primary to-primary/60" />
                  </div>
                  <div className="pb-4">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-primary">{s.when}</p>
                    <p className="text-[11px] font-semibold text-accent-foreground">{s.what}</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{s.how}</p>
                  </div>
                </div>
              ))}
              <div className="flex gap-3">
                <div className="flex flex-col items-center w-4 shrink-0">
                  <div className="w-[10px] h-[10px] rounded-full border-2 border-primary bg-secondary shrink-0" />
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-primary">Mês 4+</p>
                  <div className="flex items-center gap-2 bg-secondary border border-border rounded-lg p-3 mt-1">
                    <Rocket className="w-5 h-5 text-primary shrink-0" />
                    <p className="text-[10px] font-semibold text-accent-foreground leading-snug">
                      Programa consistente. Efeito composto. Awareness cresce exponencialmente mês a mês.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ ROI CHART ═══ */}
        <section className="bg-card border rounded-xl p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <h3 className="font-headline text-sm font-bold text-accent-foreground">Ads é platô. Employee Advocacy é efeito composto.</h3>
            <p className="text-[10px] text-muted-foreground">Ads só funciona enquanto você paga. EGC se compõe com o tempo — e não para.</p>
          </div>
          <svg viewBox="0 0 680 170" className="w-full h-auto block" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="egcFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#CD50F1" stopOpacity="0.15"/>
                <stop offset="100%" stopColor="#CD50F1" stopOpacity="0"/>
              </linearGradient>
              <clipPath id="chartClip"><rect x="60" y="5" width="570" height="135"/></clipPath>
            </defs>

            {/* Grid */}
            <line x1="60" y1="10" x2="60" y2="140" stroke="hsl(279 33% 90%)" strokeWidth="1"/>
            <line x1="60" y1="140" x2="630" y2="140" stroke="hsl(279 33% 90%)" strokeWidth="1"/>
            <line x1="60" y1="105" x2="630" y2="105" stroke="hsl(279 33% 90%)" strokeWidth="0.5" strokeDasharray="4"/>
            <line x1="60" y1="70" x2="630" y2="70" stroke="hsl(279 33% 90%)" strokeWidth="0.5" strokeDasharray="4"/>
            <line x1="60" y1="35" x2="630" y2="35" stroke="hsl(279 33% 90%)" strokeWidth="0.5" strokeDasharray="4"/>

            {/* "Investimento em ads parou" vertical line */}
            <line x1="420" y1="15" x2="420" y2="140" stroke="#D4A0B8" strokeWidth="1" strokeDasharray="4,3" opacity="0.6"/>
            <text x="420" y="11" fontFamily="Inter, sans-serif" fontSize="7" fill="#C06080" textAnchor="middle" fontWeight="600">investimento em ads parou</text>

            {/* Ads line: starts higher, rises gently, then drops abruptly */}
            <path d="M60,92 C130,89 200,85 270,82 C330,79 370,77 420,74" fill="none" stroke="#B8A4CC" strokeWidth="2.2" strokeLinecap="round" clipPath="url(#chartClip)"/>
            <path d="M420,74 C440,88 460,115 480,130 C490,135 500,138 520,139" fill="none" stroke="#B8A4CC" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="5,4" opacity="0.5" clipPath="url(#chartClip)"/>

            {/* Ads annotation */}
            <text x="530" y="135" fontFamily="Inter, sans-serif" fontSize="7" fill="#C0A4B8" opacity="0.8">Sem budget, alcance cai.</text>

            {/* EGC area fill */}
            <path d="M60,138 C130,136 200,130 270,118 C340,100 380,78 420,58 C470,38 530,22 580,14 L630,10 L630,140 L60,140 Z" fill="url(#egcFill)" clipPath="url(#chartClip)"/>

            {/* EGC line: starts from zero, compound growth, continues after ads stop */}
            <path d="M60,138 C130,136 200,130 270,118 C340,100 380,78 420,58 C470,38 530,22 580,14 L630,10" fill="none" stroke="#CD50F1" strokeWidth="2.8" strokeLinecap="round" clipPath="url(#chartClip)"/>

            {/* Line labels */}
            <text x="610" y="71" fontFamily="Inter, sans-serif" fontSize="8.5" fill="#B8A4CC" fontWeight="600">Ads</text>
            <text x="610" y="8" fontFamily="Inter, sans-serif" fontSize="8.5" fill="#CD50F1" fontWeight="700">EGC</text>

            {/* Month labels */}
            <text x="118" y="157" fontFamily="Inter, sans-serif" fontSize="9" fill="hsl(279 33% 45%)" textAnchor="middle">Mês 1</text>
            <text x="232" y="157" fontFamily="Inter, sans-serif" fontSize="9" fill="hsl(279 33% 45%)" textAnchor="middle">Mês 2</text>
            <text x="346" y="157" fontFamily="Inter, sans-serif" fontSize="9" fill="hsl(279 33% 45%)" textAnchor="middle">Mês 3</text>
            <text x="460" y="157" fontFamily="Inter, sans-serif" fontSize="9" fill="hsl(279 33% 45%)" textAnchor="middle">Mês 4</text>
            <text x="574" y="157" fontFamily="Inter, sans-serif" fontSize="9" fill="hsl(279 33% 45%)" textAnchor="middle">Mês 5</text>
          </svg>
        </section>

        {/* ═══ FLOW ═══ */}
        <section className="bg-card border rounded-xl p-5 mb-6">
          <span className="inline-flex text-[10px] font-bold uppercase tracking-wide bg-primary text-white px-3 py-1 rounded-full mb-4">
            como funciona
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-0">
            {[
              { n: '1', label: 'Setup', desc: 'Brand Context, trilhas, recompensas, time convidado' },
              { n: '2', label: 'Criação', desc: 'IA + voz pessoal = conteúdo autêntico em segundos' },
              { n: '3', label: 'Hábito', desc: 'Missões e trilhas educam e criam rotina' },
              { n: '4', label: 'Jogo', desc: 'Rankings, pontos e lojinha de recompensas' },
              { n: '5', label: 'Retorno', desc: 'Awareness, remarketing e marca forte' },
            ].map((s, i) => (
              <div key={s.n} className="text-center px-2 py-3 relative">
                {i < 4 && <span className="hidden sm:block absolute right-[-8px] top-1/2 -translate-y-1/2 text-primary font-bold text-lg z-10">→</span>}
                <div className="w-7 h-7 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center mx-auto mb-2">{s.n}</div>
                <p className="text-[10px] font-bold text-accent-foreground mb-1">{s.label}</p>
                <p className="text-[9px] text-muted-foreground leading-snug">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══ BENEFITS ═══ */}
        <section className="space-y-3 mb-6">
          <div className="bg-gradient-to-br from-[#5E2A67] to-[#3A1A45] rounded-xl px-5 py-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex text-[10px] font-bold uppercase tracking-wide bg-[#0F0A18] text-primary px-3 py-1 rounded-full shrink-0">pra empresa</span>
            <div className="flex flex-wrap gap-2">
              {['Awareness mensurável', 'Mais engajamento', 'Menos turnover', 'Cultura de colaboração', 'Autoridade descentralizada', 'Remarketing quente'].map((b) => (
                <span key={b} className="text-[10px] font-semibold px-3 py-1 rounded-full bg-primary/20 text-purple-200">{b}</span>
              ))}
            </div>
          </div>
          <div className="bg-secondary border rounded-xl px-5 py-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex text-[10px] font-bold uppercase tracking-wide bg-primary text-white px-3 py-1 rounded-full shrink-0">pro colaborador</span>
            <div className="flex flex-wrap gap-2">
              {['Marca pessoal', 'Desenvolvimento', 'Recompensas', 'Visibilidade', 'Trilhas educativas', 'Reconhecimento'].map((b) => (
                <span key={b} className="text-[10px] font-semibold px-3 py-1 rounded-full bg-card text-accent-foreground border">{b}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ TIMELINE ═══ */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { when: 'Semana 1', what: 'Setup completo', detail: 'Brand Context + trilhas + loja + time' },
            { when: 'Semana 2-3', what: 'Primeiros posts', detail: 'Conteúdo com IA + primeiras missões' },
            { when: 'Mês 1-2', what: 'Dados reais', detail: 'Impressões, engajamento, valor em R$' },
            { when: 'Mês 3+', what: 'Efeito composto', detail: 'ROI positivo, programa autossuficiente' },
          ].map((t) => (
            <div key={t.when} className="bg-card border rounded-xl p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wide text-primary/70 mb-1">{t.when}</p>
              <p className="text-[11px] font-semibold text-accent-foreground mb-1">{t.what}</p>
              <p className="text-[9px] text-muted-foreground">{t.detail}</p>
            </div>
          ))}
        </section>

        {/* ═══ BETA BANNER ═══ */}
        <section className="bg-gradient-to-br from-[#1A0E2E] to-[#0F0A18] rounded-xl px-6 py-5 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 border-2 border-primary relative overflow-hidden">
          <div className="absolute top-3 right-[-28px] bg-primary text-white text-[8px] font-extrabold tracking-widest px-8 py-[3px] rotate-45">BETA</div>
          <div>
            <h3 className="font-headline text-lg font-bold text-white mb-1">
              <span className="text-primary">5 vagas beta.</span> Zero risco.
            </h3>
            <p className="text-[11px] text-white/50">2 meses grátis · até 5 colaboradores · setup assistido · estratégia inclusa · sem compromisso</p>
          </div>
          <div className="flex gap-2 shrink-0">
            {['Setup grátis', 'Estratégia inclusa', 'Suporte direto'].map((f) => (
              <span key={f} className="text-[10px] font-bold px-3 py-2 rounded-lg bg-primary/20 text-primary whitespace-nowrap">{f}</span>
            ))}
          </div>
        </section>

        {/* ═══ PRICING ═══ */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { range: '5 – 10 seats', price: 'R$ 499', featured: false },
            { range: '11 – 30 seats', price: 'R$ 399', featured: false },
            { range: '31 – 99 seats', price: 'R$ 299', featured: false },
            { range: '100+ seats', price: 'R$ 199', featured: true },
          ].map((p) => (
            <div key={p.range} className={`bg-card rounded-xl p-4 text-center ${p.featured ? 'border-2 border-primary bg-secondary' : 'border'}`}>
              <p className="text-[10px] font-semibold text-primary/70 mb-1">{p.range}</p>
              <p className="font-headline text-xl font-bold text-accent-foreground">{p.price}</p>
              <p className="text-[9px] text-muted-foreground">/seat por mês</p>
            </div>
          ))}
        </section>

        {/* ═══ CTA ═══ */}
        <section className="bg-gradient-to-br from-[#0F0A18] to-[#1A0E2E] rounded-xl px-6 py-5 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="font-headline text-base md:text-lg font-bold text-white mb-1">
              Vamos construir o <span className="text-primary">programa de advocacy</span> da sua empresa?
            </h2>
            <p className="text-[11px] text-white/40">Estratégia primeiro. Execução pela plataforma. A gente faz junto.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button onClick={scrollToForm} className="text-[11px] font-bold">
              Montar meu programa <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
            <Button onClick={scrollToForm} variant="outline" className="text-[11px] font-bold border-primary/40 text-white/60 hover:text-white hover:bg-primary/10 bg-transparent">
              Quero ser beta tester
            </Button>
          </div>
        </section>

        {/* ═══ FORM ═══ */}
        <section id="form-section" className="bg-card border rounded-xl p-6 md:p-8 mb-8 scroll-mt-20">
          {sent ? (
            /* Success state */
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="font-headline text-xl font-bold text-accent-foreground mb-2">
                Recebemos seu interesse!
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                Entraremos em contato em breve. Se quiser agilizar, agende uma conversa diretamente na nossa agenda:
              </p>
              <a href={CALENDAR_URL} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="text-sm font-bold gap-2">
                  <Calendar className="w-4 h-4" />
                  Agendar uma conversa
                </Button>
              </a>
            </div>
          ) : (
            /* Form */
            <>
              <div className="text-center mb-6">
                <span className="inline-flex text-[10px] font-bold uppercase tracking-wide bg-primary text-white px-3 py-1 rounded-full mb-3">
                  quero participar do beta
                </span>
                <h3 className="font-headline text-lg font-bold text-accent-foreground mb-1">
                  Preencha seus dados para entrar na lista
                </h3>
                <p className="text-sm text-muted-foreground">
                  Vamos entrar em contato para montar o programa junto com você.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-4">
                {/* Row: Nome + Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="nome" className="text-xs">Nome completo *</Label>
                    <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs">Email corporativo *</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" required />
                  </div>
                </div>

                {/* Row: Telefone + Cargo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="telefone" className="text-xs">WhatsApp / Telefone *</Label>
                    <Input id="telefone" type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cargo" className="text-xs">Cargo *</Label>
                    <select id="cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} required
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <option value="">Selecione...</option>
                      <option value="CMO">CMO / Diretor(a) de Marketing</option>
                      <option value="Head de Vendas">Head de Vendas / Sales Enablement</option>
                      <option value="CEO">CEO / Founder</option>
                      <option value="Head de People">Head de People / HRBP</option>
                      <option value="Coord. Marketing">Coord. de Marketing / Analista</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                </div>

                {/* Row: Empresa + Setor */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="empresa" className="text-xs">Empresa *</Label>
                    <Input id="empresa" value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Nome da empresa" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="setor" className="text-xs">Setor *</Label>
                    <select id="setor" value={setor} onChange={(e) => setSetor(e.target.value)} required
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <option value="">Selecione...</option>
                      <option value="Tech/SaaS">Tech / SaaS B2B</option>
                      <option value="Fintech">Fintech / Banco Digital</option>
                      <option value="Consultoria">Consultoria / Professional Services</option>
                      <option value="Indústria">Indústria</option>
                      <option value="Startup B2B">Startup B2B</option>
                      <option value="EdTech">Educação corporativa / EdTech</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                </div>

                {/* Row: Colaboradores + Objetivo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="colaboradores" className="text-xs">Quantidade de colaboradores *</Label>
                    <select id="colaboradores" value={colaboradores} onChange={(e) => setColaboradores(e.target.value)} required
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <option value="">Selecione...</option>
                      <option value="5-10">5 – 10</option>
                      <option value="11-30">11 – 30</option>
                      <option value="31-99">31 – 99</option>
                      <option value="100-500">100 – 500</option>
                      <option value="500+">500+</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="objetivo" className="text-xs">Objetivo principal *</Label>
                    <select id="objetivo" value={objetivoPrincipal} onChange={(e) => setObjetivoPrincipal(e.target.value)} required
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                      <option value="">Selecione...</option>
                      <option value="Marketing/Awareness">Marketing / Awareness</option>
                      <option value="Social Selling">Social Selling</option>
                      <option value="Employer Branding">Employer Branding</option>
                      <option value="Todos">Todos os anteriores</option>
                    </select>
                  </div>
                </div>

                {/* Como conheceu */}
                <div className="space-y-1.5">
                  <Label htmlFor="como" className="text-xs">Como conheceu a Boldfy? *</Label>
                  <select id="como" value={comoConheceu} onChange={(e) => setComoConheceu(e.target.value)} required
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                    <option value="">Selecione...</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Indicação">Indicação</option>
                    <option value="Google">Google</option>
                    <option value="Evento">Evento</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                {/* Observações */}
                <div className="space-y-1.5">
                  <Label htmlFor="obs" className="text-xs">Observações <span className="text-muted-foreground">(opcional)</span></Label>
                  <Textarea id="obs" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Conte-nos mais sobre sua empresa ou o que espera do programa..." rows={3} />
                </div>

                {error && (
                  <div className="text-sm text-destructive text-center">{error}</div>
                )}

                <Button type="submit" className="w-full font-bold" disabled={sending}>
                  {sending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</>
                  ) : (
                    <>Quero participar do beta <ArrowRight className="w-4 h-4 ml-2" /></>
                  )}
                </Button>
              </form>
            </>
          )}
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Boldfy. Todos os direitos reservados.</p>
          <Link href="/privacidade" className="hover:text-foreground transition-colors">Política de Privacidade</Link>
        </div>
      </footer>
    </div>
  );
}
