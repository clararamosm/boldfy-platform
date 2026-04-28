# Cron Setup — Cloud Scheduler

Guia para configurar os 3 jobs de billing no Google Cloud Scheduler.

## Pré-requisitos

- Acesso ao projeto Firebase/GCP da Boldfy.
- Permissão `Cloud Scheduler Admin` no IAM.
- O segredo `CRON_SECRET` já está configurado em `apphosting.yaml` (Cloud Secret Manager). Não precisa setar nada novo.

## Os 3 jobs

| Job | Endpoint | Frequência | Horário ideal (BRT) | O que faz |
|---|---|---|---|---|
| 1 | `GET /api/cron/check-trial-expiration` | diário | 03:30 | Promove Platform `free → pending` quando trial vence |
| 2 | `GET /api/cron/check-deadlines` | diário | 04:00 | Promove módulos `pending → blocked` quando deadline vence |
| 3 | `GET /api/cron/check-beta-expiration` | diário | 04:30 | Desliga `isBetaTester` quando beta vence |

> **Ordem importa pouco**, mas seguir esse intervalo de 30min garante que o trial expirado entre na verificação de deadline no mesmo dia (caso o card deadline já tenha expirado também — improvável mas possível em testes).

## Configurando cada job

### Via Console (UI)

1. Acesse https://console.cloud.google.com/cloudscheduler
2. Confirme que está no projeto certo (canto superior esquerdo).
3. Clique em **CREATE JOB**.
4. Preencha conforme tabela abaixo.

**Campos comuns aos 3 jobs:**

| Campo | Valor |
|---|---|
| Region | `us-central1` (mesma do App Hosting) |
| Frequency | `30 3 * * *` (job 1), `0 4 * * *` (job 2), `30 4 * * *` (job 3) |
| Timezone | `America/Sao_Paulo` |
| Target type | `HTTP` |
| HTTP method | `GET` |
| URL | `https://<seu-domínio>.run.app/api/cron/<endpoint>` |
| Auth header | `Add header` → Key: `Authorization`, Value: `Bearer <CRON_SECRET value>` |
| Attempt deadline | `60s` |
| Max retry attempts | `3` |
| Min backoff | `30s` |

**Específicos:**

#### Job 1 — Trial Expiration (NOVO)

```
Name:        boldfy-cron-check-trial-expiration
Description: Promove Platform free -> pending quando trial vence
URL:         https://<seu-dominio>/api/cron/check-trial-expiration
Frequency:   30 3 * * *
```

#### Job 2 — Module Deadlines (já existe)

```
Name:        boldfy-cron-check-deadlines
URL:         https://<seu-dominio>/api/cron/check-deadlines
Frequency:   0 4 * * *
```

#### Job 3 — Beta Expiration (já existe)

```
Name:        boldfy-cron-check-beta-expiration
URL:         https://<seu-dominio>/api/cron/check-beta-expiration
Frequency:   30 4 * * *
```

### Via gcloud CLI (alternativa)

```bash
# Substitua DOMAIN e SECRET antes de rodar
DOMAIN="seu-dominio.run.app"
SECRET="$(gcloud secrets versions access latest --secret=CRON_SECRET)"
PROJECT="seu-projeto-gcp"
REGION="us-central1"

# Job 1 (NOVO)
gcloud scheduler jobs create http boldfy-cron-check-trial-expiration \
  --project=$PROJECT \
  --location=$REGION \
  --schedule="30 3 * * *" \
  --time-zone="America/Sao_Paulo" \
  --uri="https://$DOMAIN/api/cron/check-trial-expiration" \
  --http-method=GET \
  --headers="Authorization=Bearer $SECRET" \
  --attempt-deadline=60s \
  --max-retry-attempts=3 \
  --min-backoff=30s \
  --description="Promove Platform free -> pending quando trial vence"
```

## Como testar antes de commitar agendamento

```bash
# Manual run via curl (substituindo DOMAIN e SECRET)
curl -i -H "Authorization: Bearer $SECRET" \
  https://$DOMAIN/api/cron/check-trial-expiration
```

Resposta esperada (200):
```json
{
  "success": true,
  "scanned": 12,
  "promotedCount": 0,
  "errorsCount": 0,
  "ranAtISO": "2025-01-15T03:30:00.000Z"
}
```

Se vier `401 Unauthorized`, o `CRON_SECRET` não bateu — confira o env do App Hosting.

## Verificação pós-deploy

Após criar o job:

1. Console Cloud Scheduler → encontre o job → clique em **Run now** para forçar execução.
2. Aguarde 30s e verifique status: deve estar `Success`.
3. Cloud Logging (filtro):
   ```
   resource.type="cloud_run_revision"
   textPayload =~ "\\[cron:check-trial-expiration\\]"
   ```
   Deve aparecer 1 linha com `scanned`, `promotedCount`, etc.
4. No próximo dia (após 03:30 BRT), confirme que rodou automaticamente em **Cloud Scheduler → Job → Logs**.

## Troubleshooting

| Sintoma | Causa provável | Fix |
|---|---|---|
| `401 Unauthorized` no log | CRON_SECRET divergente entre Scheduler e App Hosting | Confirme `gcloud secrets versions access latest --secret=CRON_SECRET` e atualize o header do Scheduler |
| `500` no log | Erro interno no Firestore ou Stripe | Veja stack trace em `[cron:check-trial-expiration] fatal:` |
| `scanned: 0` sempre | Filtro `billing.platform.status == 'free'` não retorna nada | Verifique no Firestore se há ao menos 1 empresa com esse status |
| Job some do Scheduler | Provavelmente foi pausado ou deletado manualmente | Recrie via UI ou gcloud |

## Notas importantes

- **Idempotência**: rodar o job 2x no mesmo dia não gera duplicação. Empresas já promovidas não são re-tocadas (filtro `status == 'free'` no query).
- **freeTrialUnlimited**: parceiros Boldfy ficam permanentemente em `free` sem `trialEndsAt`. O guard `if (!trialEnd) continue` os protege automaticamente.
- **Beta tester ativo**: o job ignora empresas em beta válido (`betaEndsAt > now`). Beta cobre tudo enquanto durar.
- **billedOutsidePlatform**: caso especial do TL (contrato direto, ex: Omie). Não afeta este cron — ele só toca `billing.platform.status`.
