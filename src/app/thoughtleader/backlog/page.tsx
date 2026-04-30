import { redirect } from 'next/navigation';

// O backlog foi integrado ao dashboard do Thought Leader.
// Mantemos esta rota para não quebrar links existentes.
export default function ThoughtLeaderBacklogRedirect() {
  redirect('/thoughtleader/dashboard');
}
