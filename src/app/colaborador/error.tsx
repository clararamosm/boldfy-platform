// src/app/colaborador/error.tsx
'use client';
import { SharedErrorBoundary } from '@/components/shared-error-boundary';
export default function ColaboradorError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <SharedErrorBoundary {...props} />;
}
