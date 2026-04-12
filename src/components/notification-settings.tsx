// src/components/notification-settings.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken } from '@/lib/auth-client';
import { saveNotificationPrefs, getNotificationPrefs } from '@/app/actions';

type NotifOption = {
  key: string;
  label: string;
  description: string;
};

type Props = {
  options: NotifOption[];
  disabled?: boolean;
};

export function NotificationSettings({ options, disabled = false }: Props) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const token = await getAuthToken();
        const result = await getNotificationPrefs(token);
        if (result.prefs) {
          // Default all to true if not set
          const merged: Record<string, boolean> = {};
          for (const opt of options) {
            merged[opt.key] = result.prefs[opt.key] !== undefined ? result.prefs[opt.key] : true;
          }
          setPrefs(merged);
        }
      } catch {
        // defaults
        const defaults: Record<string, boolean> = {};
        for (const opt of options) defaults[opt.key] = true;
        setPrefs(defaults);
      }
      setLoaded(true);
    })();
  }, [options]);

  const handleToggle = async (key: string, checked: boolean) => {
    const updated = { ...prefs, [key]: checked };
    setPrefs(updated);
    try {
      const token = await getAuthToken();
      const result = await saveNotificationPrefs(token, updated);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Erro ao salvar preferência', description: result.error });
        setPrefs({ ...prefs }); // revert
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao salvar preferência' });
      setPrefs({ ...prefs }); // revert
    }
  };

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notificações por e-mail</CardTitle>
        <CardDescription>Escolha quais notificações deseja receber por e-mail.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {options.map((opt) => (
          <div key={opt.key} className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor={`notif-${opt.key}`} className={disabled ? 'text-muted-foreground' : ''}>
                {opt.label}
              </Label>
              <p className="text-sm text-muted-foreground">{opt.description}</p>
            </div>
            <Switch
              id={`notif-${opt.key}`}
              checked={prefs[opt.key] ?? true}
              onCheckedChange={(checked) => handleToggle(opt.key, checked)}
              disabled={disabled}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
