'use client';

import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from '@/lib/i18n/context';

export default function ThoughtLeaderLinkedInFeedPage() {
  const t = useT();

  return (
    <>
      <Header title={t.nav.linkedinFeed} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>{t.linkedinFeed.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{t.linkedinFeed.emptyTitle}</p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
