// src/app/strategist/error.tsx
'use client';

import { SharedErrorBoundary } from '@/components/shared-error-boundary';

export default function StrategistError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <SharedErrorBoundary {...props} />;
}
