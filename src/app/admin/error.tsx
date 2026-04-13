// src/app/admin/error.tsx
'use client';

import { SharedErrorBoundary } from '@/components/shared-error-boundary';

export default function AdminError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <SharedErrorBoundary {...props} />;
}
