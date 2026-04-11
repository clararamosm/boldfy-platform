'use client';

import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CalendarDays, Clock, TrendingUp } from "lucide-react";
import { useT } from '@/lib/i18n/context';
import { interpolate } from '@/lib/i18n/interpolate';
import { useAuth } from '@/contexts/auth-context';

export default function ThoughtLeaderDashboardPage() {
  const t = useT();
  const { user } = useAuth();

  return (
    <>
      <Header title={t.thoughtLeader.dashboardTitle} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">{interpolate(t.thoughtLeader.greeting, { name: (user?.name || '').split(' ')[0] })}</h2>
          <p className="text-muted-foreground">{t.thoughtLeader.subtitle}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t.thoughtLeader.postsPublished}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t.thoughtLeader.postsScheduled}</CardTitle>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t.thoughtLeader.pendingApproval}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t.thoughtLeader.impressionsTotal}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t.thoughtLeader.backlogTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{t.contentPipeline.noPostsInStatus}</p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
