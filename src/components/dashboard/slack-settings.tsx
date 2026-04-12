// src/components/dashboard/slack-settings.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/auth-context';
import { getAuthToken } from '@/lib/auth-client';
import {
  Loader2,
  Info,
  Send,
  ChevronDown,
  Hash,
  Copy,
  Check,
} from "lucide-react";

import {
  getSlackChannels,
  getSlackConfig,
  saveSlackConfig,
  testSlackNotification,
  getStrategistSidebarData,
} from '@/app/actions';

import {
  NOTIFICATION_META,
  DEFAULT_TEMPLATES,
  TEMPLATE_VARIABLES,
  type SlackNotificationType,
  type NotificationEntry,
} from '@/lib/slack-types';

// ---- Types ----

type Channel = { id: string; name: string };

type NotificationState = {
  enabled: boolean;
  template: string;
  dayOfWeek?: number;
  timeOfDay?: string;
};

type CompanyData = {
  id: string;
  name: string;
  tls: { id: string; name: string }[];
};

// Ordered: internal first, then client
const NOTIF_TYPES_ORDERED: SlackNotificationType[] = [
  'resumo_semanal',
  'feedback_recebido',
  'lembrete_aprovacao',
  'dropin_semanal',
  'post_pronto',
];

const DAYS_OF_WEEK = [
  { value: 1, label: 'Segunda' },
  { value: 2, label: 'Terça' },
  { value: 3, label: 'Quarta' },
  { value: 4, label: 'Quinta' },
  { value: 5, label: 'Sexta' },
];

function createDefaultNotifications(): Record<SlackNotificationType, NotificationState> {
  const initial: Record<string, NotificationState> = {};
  for (const type of NOTIF_TYPES_ORDERED) {
    initial[type] = {
      enabled: false,
      template: DEFAULT_TEMPLATES[type],
      ...(type === 'dropin_semanal' ? { dayOfWeek: 2, timeOfDay: '10:00' } : {}),
    };
  }
  return initial as Record<SlackNotificationType, NotificationState>;
}

// ---- Main Component ----

export function SlackSettingsCard() {
  const { toast } = useToast();
  const { user } = useAuth();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [isLoadingInit, setIsLoadingInit] = useState(true);

  const loadInitialData = useCallback(async () => {
    try {
      setIsLoadingInit(true);
      const token = await getAuthToken();
      if (!token) return;

      const [channelsResult, sidebarResult] = await Promise.all([
        getSlackChannels(token),
        getStrategistSidebarData(token),
      ]);

      if (channelsResult.channels) setChannels(channelsResult.channels);
      if (sidebarResult.companies) setCompanies(sidebarResult.companies);
    } catch (error) {
      console.error('Error loading Slack initial data:', error);
      toast({ variant: 'destructive', title: 'Erro ao carregar dados do Slack.' });
    } finally {
      setIsLoadingInit(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user) loadInitialData();
  }, [user, loadInitialData]);

  if (isLoadingInit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notificações Slack</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (companies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Notificações Slack</CardTitle>
              <CardDescription className="mt-1">
                Configure notificações automáticas para canais do Slack por perfil.
              </CardDescription>
            </div>
            <VariablesInfoPopover />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma empresa encontrada. Verifique suas atribuições.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Notificações Slack</CardTitle>
            <CardDescription className="mt-1">
              Configure notificações automáticas para canais do Slack por perfil.
            </CardDescription>
          </div>
          <VariablesInfoPopover />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {companies.map(company => (
          <CompanyBlock
            key={company.id}
            company={company}
            channels={channels}
          />
        ))}
      </CardContent>
    </Card>
  );
}

// ---- Company Block ----

function CompanyBlock({
  company,
  channels,
}: {
  company: CompanyData;
  channels: Channel[];
}) {
  const { toast } = useToast();

  const [selectedTl, setSelectedTl] = useState<string>('');
  const [channelId, setChannelId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState<string | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testingType, setTestingType] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<Record<SlackNotificationType, NotificationState>>(
    createDefaultNotifications
  );

  // Auto-select first TL if only one
  useEffect(() => {
    if (company.tls.length === 1 && !selectedTl) {
      setSelectedTl(company.tls[0].id);
    }
  }, [company.tls, selectedTl]);

  // Load config when TL changes
  const loadConfig = useCallback(async (tlId: string) => {
    try {
      setIsLoadingConfig(true);
      const token = await getAuthToken();
      if (!token) return;

      const result = await getSlackConfig(token, company.id, tlId);

      if (result.config) {
        // Load profile-level channel
        setChannelId(result.config.channelId ?? null);
        setChannelName(result.config.channelName ?? null);

        const newState: Record<string, NotificationState> = {};
        for (const type of NOTIF_TYPES_ORDERED) {
          const saved = result.config.notifications[type];
          newState[type] = {
            enabled: saved?.enabled ?? false,
            template: saved?.template || DEFAULT_TEMPLATES[type],
            ...(type === 'dropin_semanal' ? {
              dayOfWeek: saved?.dayOfWeek ?? 2,
              timeOfDay: saved?.timeOfDay ?? '10:00',
            } : {}),
          };
        }
        setNotifications(newState as Record<SlackNotificationType, NotificationState>);
      } else {
        setChannelId(null);
        setChannelName(null);
        setNotifications(createDefaultNotifications());
      }
    } catch (error) {
      console.error('Error loading Slack config:', error);
    } finally {
      setIsLoadingConfig(false);
    }
  }, [company.id]);

  useEffect(() => {
    if (selectedTl) {
      loadConfig(selectedTl);
    }
  }, [selectedTl, loadConfig]);

  const handleChannelChange = (newChannelId: string) => {
    const ch = channels.find(c => c.id === newChannelId);
    setChannelId(newChannelId);
    setChannelName(ch?.name || null);
  };

  const handleNotifChange = (type: SlackNotificationType, field: string, value: unknown) => {
    setNotifications(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: value },
    }));
  };

  const handleSave = async () => {
    if (!selectedTl) return;
    setIsSaving(true);
    try {
      const token = await getAuthToken();
      if (!token) return;

      const tl = company.tls.find(t => t.id === selectedTl);

      // Build notification entries (without channel — server will propagate from config level)
      const notifData: Record<string, Partial<NotificationEntry>> = {};
      for (const type of NOTIF_TYPES_ORDERED) {
        const n = notifications[type];
        notifData[type] = {
          enabled: n.enabled,
          template: n.template,
          ...(type === 'dropin_semanal' ? {
            dayOfWeek: n.dayOfWeek,
            timeOfDay: n.timeOfDay,
          } : {}),
        };
      }

      const result = await saveSlackConfig(token, company.id, selectedTl, {
        companyName: company.name,
        tlName: tl?.name || '',
        channelId,
        channelName,
        notifications: notifData as Record<SlackNotificationType, Partial<NotificationEntry>>,
      });

      if (result.success) {
        toast({ title: 'Configurações Slack salvas!' });
      } else {
        toast({ variant: 'destructive', title: result.error || 'Erro ao salvar.' });
      }
    } catch (error) {
      console.error('Error saving Slack config:', error);
      toast({ variant: 'destructive', title: 'Erro ao salvar configurações.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async (type: SlackNotificationType) => {
    if (!channelId) {
      toast({ variant: 'destructive', title: 'Selecione um canal primeiro.' });
      return;
    }
    setTestingType(type);
    try {
      const token = await getAuthToken();
      const result = await testSlackNotification(token, channelId, NOTIFICATION_META[type].label);
      if (result?.success) {
        toast({ title: '✅ Mensagem de teste enviada com sucesso!' });
      } else {
        toast({ variant: 'destructive', title: 'Erro no Slack', description: result?.error || 'Falha ao enviar mensagem de teste.' });
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Erro desconhecido ao enviar teste.';
      console.error('Error testing Slack:', error);
      toast({ variant: 'destructive', title: 'Erro ao enviar teste', description: msg });
    } finally {
      setTestingType(null);
    }
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      {/* Company header */}
      <h3 className="font-semibold text-sm">{company.name}</h3>

      {/* TL selector + Channel — side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Perfil</Label>
          <Select value={selectedTl} onValueChange={setSelectedTl}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione o perfil" />
            </SelectTrigger>
            <SelectContent>
              {company.tls.map(tl => (
                <SelectItem key={tl.id} value={tl.id}>{tl.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTl && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Canal do Slack</Label>
            <Select value={channelId || ''} onValueChange={handleChannelChange}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Selecione o canal" />
              </SelectTrigger>
              <SelectContent>
                {channels.map(ch => (
                  <SelectItem key={ch.id} value={ch.id}>
                    <span className="flex items-center gap-1">
                      <Hash className="h-3 w-3" />{ch.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Notification rows — compact */}
      {selectedTl && (
        <>
          {isLoadingConfig ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="space-y-1.5">
              {NOTIF_TYPES_ORDERED.map(type => (
                <NotificationRow
                  key={type}
                  type={type}
                  state={notifications[type]}
                  isTesting={testingType === type}
                  hasChannel={!!channelId}
                  onChange={(field, value) => handleNotifChange(type, field, value)}
                  onTest={() => handleTest(type)}
                />
              ))}
            </div>
          )}

          {/* Save button */}
          <div className="flex justify-end pt-1">
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              {isSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
              ) : (
                'Salvar Configurações'
              )}
            </Button>
          </div>
        </>
      )}

      {!selectedTl && (
        <p className="text-sm text-muted-foreground text-center py-3">
          Selecione um perfil para configurar as notificações.
        </p>
      )}
    </div>
  );
}

// ---- Notification Row (compact — no channel selector) ----

function NotificationRow({
  type,
  state,
  isTesting,
  hasChannel,
  onChange,
  onTest,
}: {
  type: SlackNotificationType;
  state: NotificationState;
  isTesting: boolean;
  hasChannel: boolean;
  onChange: (field: string, value: unknown) => void;
  onTest: () => void;
}) {
  const meta = NOTIFICATION_META[type];
  const [isOpen, setIsOpen] = useState(false);
  const isClient = meta.tag === 'cliente';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-md border bg-background px-3 py-2">
        {/* Single compact row: tag + name + schedule + toggle + expand */}
        <div className="flex items-center gap-2">
          <Badge
            variant={isClient ? 'outline' : 'secondary'}
            className="text-[10px] px-1.5 py-0 h-4 font-normal shrink-0"
          >
            {isClient ? 'Cliente' : 'Interna'}
          </Badge>

          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium">{meta.label}</span>
            <span className="text-xs text-muted-foreground ml-1.5">({meta.schedule})</span>
          </div>

          <Switch
            checked={state.enabled}
            onCheckedChange={(checked) => onChange('enabled', checked)}
            className="shrink-0"
          />

          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0">
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
        </div>

        {/* Client reminder — only when enabled */}
        {isClient && state.enabled && (
          <p className="text-[11px] text-muted-foreground mt-1 italic pl-[52px]">
            Chegará no canal interno. Lembre-se de repassar ao cliente.
          </p>
        )}

        {/* Expandable: template + dropin config + test */}
        <CollapsibleContent className="mt-2 space-y-2">
          {type === 'dropin_semanal' && (
            <div className="flex gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Dia</Label>
                <Select
                  value={String(state.dayOfWeek || 2)}
                  onValueChange={(v) => onChange('dayOfWeek', parseInt(v))}
                >
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(d => (
                      <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Horário</Label>
                <Select
                  value={state.timeOfDay || '10:00'}
                  onValueChange={(v) => onChange('timeOfDay', v)}
                >
                  <SelectTrigger className="w-[100px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Template da mensagem</Label>
            <Textarea
              value={state.template}
              onChange={(e) => onChange('template', e.target.value)}
              className="font-mono text-xs min-h-[80px] resize-y"
              placeholder="Template da mensagem..."
            />
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onTest}
              disabled={!hasChannel || isTesting}
            >
              {isTesting ? (
                <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Enviando...</>
              ) : (
                <><Send className="mr-1 h-3 w-3" /> Enviar Teste</>
              )}
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ---- Variables Info Popover ----

function VariablesInfoPopover() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Info className="h-4 w-4 mr-1" /> Variáveis
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] max-h-[400px] overflow-y-auto" align="end">
        <div className="space-y-1">
          <h4 className="font-semibold text-sm mb-2">Variáveis disponíveis</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Clique para copiar. Use nos templates de mensagem.
          </p>
          {TEMPLATE_VARIABLES.map(v => (
            <button
              key={v.key}
              onClick={() => handleCopy(v.key)}
              className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-muted text-left group"
            >
              <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded shrink-0 group-hover:bg-primary/10">
                {v.key}
              </code>
              <span className="text-xs text-muted-foreground flex-1 truncate">{v.description}</span>
              {copiedKey === v.key ? (
                <Check className="h-3 w-3 text-green-500 shrink-0" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
