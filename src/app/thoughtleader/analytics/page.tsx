'use client';

import { useAuth } from '@/contexts/auth-context';
import { Header } from '@/components/dashboard/header';
import { AnalyticsDashboard } from '@/components/linkedin-analytics/analytics-dashboard';
import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';

export default function ThoughtLeaderAnalyticsPage() {
  const { user } = useAuth();

  const uploadPending = useMemo(() => {
    if (!user) return false;
    const status = (user as { linkedinSnapshotStatus?: { lastUploadMonth?: string } }).linkedinSnapshotStatus;
    const lastMonth = status?.lastUploadMonth;
    // O extract pendente é o do MÊS PASSADO (em maio, espera-se abril).
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousMonth = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;
    return !lastMonth || lastMonth < previousMonth;
  }, [user]);

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
          role="thoughtleader"
          showActionPlan={true}
          readOnlyActionPlan={true}
          showMediaValue={false}
          showIcpScore={true}
          uploadPending={uploadPending}
        />
      </div>
    </div>
  );
}
