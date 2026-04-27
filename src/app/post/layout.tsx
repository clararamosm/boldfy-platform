// src/app/post/layout.tsx
// Layout para a rota /post/[companyId]/[tlId]/[postId].
// Envolve com AuthProvider para que useAuth() funcione no SlugResolver
// e PostEditorShell. Não usa RoleLayout porque essa rota precisa servir
// múltiplos roles (estrategista, thought leader e master) com a mesma URL.
'use client';

import { AuthProvider } from '@/contexts/auth-context';

export default function PostRouteLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
