import { redirect } from 'next/navigation';

/**
 * /admin/analytics redireciona para a view de Thought Leaders.
 * Mantido para não quebrar links existentes.
 */
export default function AdminAnalyticsRedirectPage() {
  redirect('/admin/analytics/thought-leaders');
}
