import { redirect } from 'next/navigation';

// O dashboard do TL foi substituído pelo Backlog unificado.
export default function ThoughtLeaderDashboardRedirect() {
  redirect('/thoughtleader/backlog');
}
