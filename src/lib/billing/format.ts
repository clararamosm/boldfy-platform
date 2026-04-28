// src/lib/billing/format.ts
// Helpers PUROS de formatacao — seguros para client e server.
// Diferente de pricing.ts (que e server-only por conter regras de cobranca),
// este arquivo so expoe utilitarios de display.

/** Formata centavos em BRL (R$ 1.234,56). Util para UI, emails e logs. */
export function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}
