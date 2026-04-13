// src/app/master/error.tsx
'use client';

import { SharedErrorBoundary } from '@/components/shared-error-boundary';

export default function MasterError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <SharedErrorBoundary {...props} />;
}
