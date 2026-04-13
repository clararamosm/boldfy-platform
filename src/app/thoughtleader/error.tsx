// src/app/thoughtleader/error.tsx
'use client';

import { SharedErrorBoundary } from '@/components/shared-error-boundary';

export default function ThoughtLeaderError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <SharedErrorBoundary {...props} />;
}
