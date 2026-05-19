'use client';

import { useAuth } from '@/contexts/auth-context';
import { Header } from '@/components/dashboard/header';
import { AnalyticsDashboard } from '@/components/linkedin-analytics/analytics-dashboard';
import { Loader2 } from 'lucide-react';
import { useExtractPending } from '@/hooks/use-extract-pending';

export default function ColaboradorAnalyticsPage() {
  const { user } = useAuth();
  // Source-of-truth: existence of the previous month's snapshot doc.
  // See use-extract-pending for why we don't read the user-doc flag here.
  const { pending: uploadPending } = useExtractPending(user?.uid);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Analytics" />
      <div className="flex-1 overflow-auto p-6">
        <AnalyticsDashboard
          userId={user.uid}
          userName={user.profile?.name ?? user.name ?? undefined}
          userAvatarUrl={user.profile?.avatarUrl ?? undefined}
          role="colaborador"
          showActionPlan={false}
          showMediaValue={false}
          // ICP fit score oculto da UI ate calibrar melhor.
          showIcpScore={false}
          uploadPending={uploadPending}
        />
      </div>
    </div>
  );
}
