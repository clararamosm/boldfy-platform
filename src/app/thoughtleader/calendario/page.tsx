'use client';

import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from '@/lib/i18n/context';

export default function ThoughtLeaderCalendarioPage() {
  const t = useT();

  return (
    <>
      <Header title={t.thoughtLeader.calendarTitle} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t.thoughtLeader.calendarTitle}</CardTitle>
            <CardDescription>{t.thoughtLeader.calendarDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{t.contentPipeline.noPostsInStatus}</p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
