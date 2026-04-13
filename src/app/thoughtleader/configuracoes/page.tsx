// src/app/thoughtleader/configuracoes/page.tsx
// Uses shared UserSettingsPage component.
'use client';

import { UserSettingsPage } from '@/components/settings/user-settings-page';

const TL_NOTIFICATIONS = [
  { key: 'post_ready_for_review', label: 'Posts prontos para revisão', description: 'Receber quando um post estiver pronto para sua aprovação.' },
];

export default function TLSettingsPage() {
  return <UserSettingsPage notificationOptions={TL_NOTIFICATIONS} />;
}
