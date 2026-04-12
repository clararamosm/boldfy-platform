// src/app/admin/linkedin-feed/page.tsx
'use client';

import LinkedInFeedView from '@/components/linkedin-feed/linkedin-feed-view';
import { useT } from '@/lib/i18n/context';

export default function AdminLinkedInFeedPage() {
  const t = useT();
  return (
    <LinkedInFeedView
      title={t.linkedinFeed.title}
      subtitle={t.linkedinFeed.subtitle}
      showYouBadge={false}
      emptyVariant="admin"
    />
  );
}
