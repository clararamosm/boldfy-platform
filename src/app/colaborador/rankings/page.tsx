// src/app/colaborador/rankings/page.tsx
// Ranking agora vive no dashboard — redirecionar quem acessar direto.
import { redirect } from 'next/navigation';

export default function RankingsRedirect() {
  redirect('/colaborador/dashboard');
}
