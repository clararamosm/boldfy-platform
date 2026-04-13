// src/app/colaborador/configuracoes/page.tsx
// Uses shared UserSettingsPage component.
'use client';

import { UserSettingsPage } from '@/components/settings/user-settings-page';

const COLAB_NOTIFICATIONS = [
  { key: 'mission_reviewed', label: 'Resultado de missões', description: 'Receber quando uma missão for aprovada ou rejeitada.' },
];

export default function ColaboradorSettingsPage() {
  return <UserSettingsPage notificationOptions={COLAB_NOTIFICATIONS} />;
}
