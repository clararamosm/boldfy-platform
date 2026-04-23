# Spec Final: Sistema de Billing Modular (Master Toggles + Per-Seat)

> Documento consolidado com todas as decisões alinhadas.
> Base para implementação em 4 fases (~12-14h).

---

## 1. Conceitos Fundamentais

### 1.1 Três módulos independentes

| Módulo | Seat mínimo | Base de preço | Beta aplica? |
|---|---|---|---|
| **Platform** (colaboradores) | 5 seats pré-ativados | Tiers por quantidade (5-10 / 11-20 / 21-40 / 41-70 / 70+) | ✅ Sim (-30%) |
| **TL** (thought leaders) | 0 seats (admin adiciona manualmente) | Matriz executivos × frequência | ❌ Não (preço cheio sempre) |
| **Design** (add-on) | N/A (escolhe pack) | Pack fixo: Starter/Growth/Scale | ❌ Não |

### 1.2 Toggles do master por empresa

- `billingEnabled: boolean` — se `false`, empresa não é cobrada (grátis, sem prazo)
- `isBetaTester: boolean` — aplica 30% de desconto apenas no módulo Platform
- `betaExpiresAt: Timestamp | null` — opcional, quando expira o benefício beta
- `notes: string` — observações internas do master

### 1.3 Default ao criar empresa

- `billingEnabled = false`
- `isBetaTester = false`
- **Não cria subscription nenhuma no Stripe**
- **Não inicia trial de 30 dias** (remove o hardcode atual em `actions/users.ts:223`)

---

## 2. Regras de Negócio

### 2.1 Platform (colaboradores)

- **Seats pré-ativados**: admin entra na plataforma já com **5 seats** de colaboradores disponíveis (limite mínimo do tier inferior)
- **Modelo Notion (per-seat dinâmico)**:
  - Adicionar colaborador → +1 seat automaticamente
  - Remover colaborador → -1 seat automaticamente
  - Stripe aplica proration automático
- **Tier recalculado quando cruza faixa**:
  - 5-10 seats = R$499/mês/seat (beta: R$349)
  - 11-20 seats = R$449/mês/seat (beta: R$315)
  - 21-40 seats = R$399/mês/seat (beta: R$279)
  - 41-70 seats = R$349/mês/seat (beta: R$245)
  - 70+ = Enterprise (negociado)

### 2.2 TL (thought leaders)

- Inicia com **0 seats**
- Admin **ativa o módulo** explicitamente + convida TLs um por um
- **Pode existir empresa só com TL** (sem colaboradores ativos no Platform)
- Preço: matriz executivos × frequência (fixa do site)
  - Ex: 2 executivos × 3 posts/semana = R$12.600/mês
- **Sem desconto beta** em nenhuma circunstância

### 2.3 Design (add-on)

- **Requer Platform ativo** (designs são feitos para colaboradores)
- **Não requer TL**
- Admin escolhe pack → clica salvar → billing inicia
- Packs:
  - Starter: 4 peças/mês, R$1.600
  - Growth: 8 peças/mês, R$2.800
  - Scale: 12 peças/mês, R$3.600
- **Sem desconto beta**

### 2.4 Combinações permitidas

✅ Só Platform
✅ Só TL
✅ Platform + TL
✅ Platform + Design
✅ Platform + TL + Design
❌ Só Design (sem Platform)
❌ TL + Design (sem Platform)

---

## 3. Fluxo Temporal (7 dias)

### 3.1 Regra uniforme para TODOS os módulos

Quando master liga `billingEnabled = true` (ou quando admin ativa um novo módulo em empresa já com billing ligado):

1. **Dia 0**: Master liga billing → admin recebe email + banner
2. **Dias 0-7**: Admin pode:
   - Configurar a empresa normalmente
   - Convidar colaboradores, TLs
   - Conectar LinkedIn
   - Escolher pack de design
   - **Fazer o primeiro pagamento** (entra no Stripe Checkout)
3. **Dia do pagamento = dia do ciclo recorrente**
   - Se paga no dia 3, próxima cobrança no dia 3 do mês seguinte
4. **Dia 7 sem pagamento**: Tela de bloqueio (subscription gate) para **toda a empresa** (admin, TLs, colaboradores)

### 3.2 Ativação de módulo adicional

Mesmo fluxo de 7 dias por módulo. Ex:
- Empresa já pagou Platform (ativo, ciclo dia 10)
- Admin ativa Design no dia 15 → tem até dia 22 para pagar Design
- Se pagar dia 18 → ciclo Design = dia 18

### 3.3 Primeiros pagamentos combinados

Se admin ativa Design **antes** do primeiro pagamento de Platform:
- Ambos entram no mesmo Checkout inicial
- Pagamento único cobre os dois
- A partir daí, ciclos separados (dia da primeira cobrança define cada um)

### 3.4 Avisos (email + banner)

- **Dia 0 (ativação)**: "Seu período de configuração começou. Você tem 7 dias para realizar o primeiro pagamento."
- **Dia 3**: "Faltam 4 dias para finalizar o pagamento"
- **Dia 6**: "Último dia — seu acesso será bloqueado amanhã"
- **Dia 7+**: Tela de bloqueio + email de suspensão

---

## 4. Exceções / Casos Especiais

Apenas 2 empresas existentes hoje:

### 4.1 Boldfy (empresa própria)
- `billingEnabled = false` permanente
- Nunca paga (ambiente de testes internos)
- Master não liga o toggle

### 4.2 Omie (cliente legado)
- TL foi contratado fora da plataforma, pago externamente
- **Admin ainda não foi convidado** (momento ideal para aplicar nova lógica)
- Quando admin for convidado:
  - `billingEnabled = true` para Platform (colaboradores normais)
  - Módulo TL **não cobrado pela plataforma** (flag especial ou não ativar o módulo de billing de TL)
  - Colaboradores que entrarem serão cobrados normalmente

### 4.3 Legacy subscriptions
- **Não precisa preservar** nada atual do Stripe
- Pode resetar tudo, apagar subscriptions de teste
- Beta toggle nunca retroativo — sempre setado **antes** de ligar billing

---

## 5. Mudanças Técnicas

### 5.1 Data Model (Firestore)

**`companies/{companyId}`** — adicionar campos:
```typescript
{
  // ... campos existentes
  billing: {
    enabled: boolean;              // master toggle
    isBetaTester: boolean;         // master toggle
    betaExpiresAt?: Timestamp;     // opcional
    notes?: string;                // observações internas

    platform: {
      active: boolean;             // módulo ativo
      seats: number;               // quantidade atual (min 5 ou 0 se desativado)
      stripeSubscriptionId?: string;
      firstPaymentDeadline?: Timestamp;  // Dia 0 + 7
      status: 'pending' | 'active' | 'blocked' | 'disabled';
    };

    tl: {
      active: boolean;
      seats: number;               // 0 ou mais
      executives: number;          // matriz
      frequency: 2 | 3 | 4;        // posts/semana
      stripeSubscriptionId?: string;
      firstPaymentDeadline?: Timestamp;
      status: 'pending' | 'active' | 'blocked' | 'disabled';
      billedOutsidePlatform?: boolean;  // caso Omie
    };

    design: {
      active: boolean;
      pack?: 'starter' | 'growth' | 'scale';
      stripeSubscriptionId?: string;
      firstPaymentDeadline?: Timestamp;
      status: 'pending' | 'active' | 'blocked' | 'disabled';
    };

    stripeCustomerId?: string;     // 1 customer, até 3 subscriptions
  };
}
```

### 5.2 Stripe

- **1 Customer** por empresa
- **Até 3 Subscriptions separadas** por customer (Platform/TL/Design)
- **Ciclos independentes** (dia de cobrança varia)
- **Proration automático** em mudanças de seat
- **Metered ou quantity-based**: usar `subscription.items[].quantity` para Platform (seats)

### 5.3 Arquivos a criar/modificar

**Criar:**
- `src/app/master/companies/[id]/billing/page.tsx` — tela de toggles por empresa
- `src/app/master/companies/[id]/billing/actions.ts` — server actions
- `src/app/admin/configuracoes/billing/page.tsx` — simulador + visão do admin
- `src/components/admin/billing-simulator.tsx` — simulador estilo proposta
- `src/components/admin/billing-warning-banner.tsx` — banner countdown
- `src/lib/billing/pricing.ts` — tabelas de preço (espelho do site)
- `src/lib/billing/stripe-modules.ts` — helpers para criar/atualizar subs por módulo
- `src/app/api/cron/billing-deadlines/route.ts` — cron verificar prazo de 7 dias
- `src/app/api/cron/beta-expirations/route.ts` — cron para expirar beta
- `src/emails/billing-reminder.tsx` — template de email
- `src/emails/billing-suspended.tsx` — template de bloqueio

**Modificar:**
- `src/app/actions/users.ts:223` — remover trial automático de 30 dias
- `src/app/actions/companies.ts` — default `billing.enabled=false` ao criar
- `src/app/api/stripe/webhook/route.ts` — lidar com 3 subscriptions
- `src/app/api/stripe/checkout/route.ts` — suportar checkout multi-módulo
- `src/lib/stripe.ts` — adicionar estrutura de prices por módulo
- `src/hooks/use-subscription.ts` — considerar 3 módulos
- `src/components/subscription-gate.tsx` — texto adequado por status
- `firestore.rules` — permitir master escrever em `companies/{id}.billing`

### 5.4 Cron Jobs

- **Diário 00:00 UTC**: verificar `firstPaymentDeadline` de cada módulo
  - Se passou sem pagamento → status `blocked`, enviar email de suspensão
  - Se faltam 1 ou 4 dias → enviar lembrete
- **Diário 00:00 UTC**: verificar `betaExpiresAt`
  - Se passou → `isBetaTester = false`, recalcular subscription (remover 30%)

---

## 6. Implementação em Fases

### Fase 1 — Master Toggles + Remover Trial (~2-3h)
- Remover trial automático em `actions/users.ts:223`
- Adicionar estrutura `billing` ao criar empresa (default off)
- Tela `/master/companies/[id]/billing` com 3 toggles
- Server action para master atualizar toggles
- Testar: criar empresa nova → billing desligado → master liga → muda flag no Firestore

**Entregável**: master pode ligar/desligar billing e beta por empresa.

### Fase 2 — Stripe Modular (~4-5h)
- Criar prices no Stripe (Platform tiers, TL matriz, Design packs)
- Refatorar webhook para lidar com `subscription_id` por módulo
- Checkout multi-módulo (Platform + Design combinados no primeiro pagamento)
- Per-seat dinâmico: hook ao criar/remover colaborador atualiza quantity
- Testar: ativar Platform → admin vê Checkout → pagar → Firestore atualiza

**Entregável**: 3 subscriptions separadas, proration automático, ciclos independentes.

### Fase 3 — Simulador Admin (~3-4h)
- Página `/admin/configuracoes/billing` com simulador
- Visual similar ao proposal-builder do site
- Mostra: seats atuais × preço, próxima cobrança, downgrade/upgrade previsto
- Botão "ativar TL" / "escolher pack Design" → inicia fluxo de 7 dias

**Entregável**: admin tem controle visual e transparente de custos.

### Fase 4 — Avisos 7 Dias (~2h)
- Cron para `firstPaymentDeadline` e `betaExpiresAt`
- Templates de email (lembrete + suspensão)
- Banner no dashboard do admin com countdown
- SubscriptionGate atualizada para status `blocked`

**Entregável**: ciclo completo funcional, admin avisado, bloqueio automático.

---

## 7. Pontos Validados com a Clara

✅ Regra de 7 dias uniforme para TODOS os módulos
✅ Primeiros pagamentos combinados (Design + Platform) permitidos
✅ Sem preservação de legacy no Stripe — pode resetar tudo
✅ Beta toggle nunca retroativo
✅ Boldfy: `billingEnabled=false` permanente
✅ Omie: Platform normal, TL com flag `billedOutsidePlatform`
✅ Tabela de preços: espelho do `boldfy-site/src/components/proposal-builder.tsx`
✅ Per-seat dinâmico estilo Notion
✅ 5 seats pré-ativados no Platform
✅ TL inicia com 0 seats
✅ Design requer Platform

---

## 8. Questão Fiscal (Brasil)

**Stripe não emite NFS-e no Brasil.** Decisão:

- **Fases 1-4**: não tratar emissão fiscal. Stripe gera recibo interno apenas.
- **Fase 5 (futura)**: integrar emissor (NFE.io / Focus NFe) via webhook `invoice.paid`.
- **Desde já**: coletar CNPJ no Checkout (tax_id) e guardar `billing.fiscal.*` no Firestore.

Estrutura preparada:
```typescript
billing: {
  // ... demais campos
  fiscal?: {
    cnpj?: string;
    razaoSocial?: string;
    inscricaoMunicipal?: string;
    endereco?: { logradouro, numero, cidade, uf, cep };
    lastNFNumber?: string;
    lastNFEmittedAt?: Timestamp;
  }
}
```

Isso deixa o caminho pavimentado sem custo agora, e evita migration de dados depois.

---

## 9. Próximo Passo

Começar **Fase 1** após aprovação final:
1. Remover trial automático
2. Adicionar `billing.*` na estrutura de companies (com default seguro)
3. Criar tela de toggles do master
4. Commit + deploy

Ordem dos arquivos da Fase 1:
1. `src/app/actions/users.ts` (remover trial)
2. `src/app/actions/companies.ts` (default billing)
3. `src/lib/billing/pricing.ts` (tabelas)
4. `src/app/master/companies/[id]/billing/page.tsx` (UI)
5. `src/app/master/companies/[id]/billing/actions.ts` (server action)
6. `firestore.rules` (permissão master)
