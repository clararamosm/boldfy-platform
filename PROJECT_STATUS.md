# Boldfy Platform - Status do Projeto

## Stack
- **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Firebase (Auth, Firestore, Storage, App Hosting)
- **AI**: Genkit + Gemini (assistente de conteudo, gerador de missoes)
- **Roles**: Master, Admin, Colaborador

---

## Backlog P1 + P2 (Todos concluidos)

1. **Sidebar + Header** - Layout responsivo com sidebar colapsavel
2. **Sistema de Recompensas** - CRUD + resgate com server actions (Admin SDK)
3. **Ranking** - Ranking por empresa com sort client-side (evita composite index)
4. **Trilhas de Aprendizagem** - Sistema completo: sessoes > trilhas > modulos (5 modos)
5. **Biblioteca de Conteudo** - Upload e gerenciamento de assets de marca
6. **Sistema de Missoes** - IA sugere missoes, status derivado de datas, upload de provas
7. **Assistente de Conteudo** - IA para refinar textos alinhados a marca
8. **Configuracoes** - Brand Context (8 campos), perfil, convites
9. **Dashboard Admin** - KPIs, graficos, atividade recente
10. **Firestore Security Rules** - Regras granulares por role

---

## Implementacao Recente

### Unificacao do Editor de Trilhas (Admin = Master)
- Session cards: icone FolderOpen, sem bolinha verde no nivel de sessao
- Builder admin: mini-dashboard (pontuacao total, bonus, modulos)
- Builder admin: reordenacao de modulos com botoes up/down
- Ambos: campo "Pontuacao por Completar" (pontuacaoBonusTrilha)
- Master: removido campo "Ordem" e badge Ordem das sessoes
- Icone Zap nos badges de pontuacao (master + admin)

### Sistema de Missoes v2 - Dois Modos de Conclusao + Painel de Aprovacao
- **Novo campo `completionMode`**: `'auto'` (auto-conclusao) ou `'proof'` (com comprovacao)
  - Auto: colaborador clica "Concluir", pontos dados automaticamente
  - Proof: colaborador envia arquivo, admin revisa no painel lateral
- **Nova server action `completeMissionSelf()`**: Valida modo auto, previne duplicatas, batch atomico (submission + pontos + historico)
- **Painel de Revisao (Sheet)**: Admin clica no badge de pendentes, abre painel lateral com preview de arquivo, feedback opcional, botoes aprovar/rejeitar
- **AI Suggestions melhoradas**: Cada sugestao da IA agora tem toggles para tipo (fixa/temporaria) e modo de conclusao (auto/comprovacao)
- **Retrocompatibilidade**: Missoes existentes sem `completionMode` tratadas como `'proof'` automaticamente

---

## Roadmap LinkedIn (Proximos Passos)

| Fase | Descricao | Status |
|------|-----------|--------|
| 2A | OAuth (Sign In with LinkedIn + OpenID Connect) | Pendente |
| 2B | Publicar posts no LinkedIn direto da plataforma | Pendente |
| 2C | Feed de posts da equipe | Pendente |
| 2D | Health check de tokens | Pendente |
| 4-light | Analytics basico (impressoes, likes, comentarios) | Pendente |
| 3 | Agendamento de posts | Pendente |

**Credenciais LinkedIn configuradas:**
- Client ID: `77wolsgmze0icj`
- Redirect URIs configurados no Developer Portal
- Produtos ativados: Share on LinkedIn + Sign In with OpenID Connect

---

## Firestore Data Model (Missoes)

```
companies/{companyId}/missions/{missionId}
  name, description, points, type ('fixed'|'timed'),
  completionMode ('auto'|'proof'), startDate?, endDate?, createdAt

companies/{companyId}/missionSubmissions/{submissionId}
  missionId, userId, userName, proofUrl?, proofFileName?,
  status ('pending'|'approved'|'rejected'), submittedAt,
  reviewedAt?, adminFeedback?, autoCompleted?
```

---

## Server Actions (Admin SDK)

| Action | Descricao |
|--------|-----------|
| `submitMissionProof` | Colaborador envia comprovacao (upload + submission pending) |
| `completeMissionSelf` | Colaborador auto-conclui missao (valida modo auto, batch atomico) |
| `reviewMissionProof` | Admin aprova/rejeita (batch: status + pontos + historico) |
| `redeemReward` | Resgate de recompensa (decrementa pontos, cria registro) |
| `markRescueAsPaid` | Admin marca resgate como pago |
| `getCompanyRanking` | Ranking da empresa (sort client-side) |
