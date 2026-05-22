// src/components/dashboard/linkedin-sidebar-box.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Linkedin, Loader2, AlertTriangle, ExternalLink, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/auth-context';
import { useT } from '@/lib/i18n/context';
import { getAuthToken } from '@/lib/auth-client';
import { getLinkedInAuthUrl, disconnectLinkedIn } from '@/app/actions/linkedin';
import { useToast } from '@/hooks/use-toast';

type TokenStatusInfo = {
  status: 'valid' | 'expiring_soon' | 'expired' | 'not_connected';
  daysLeft: number;
};

type Props = {
  tokenStatus: TokenStatusInfo;
};

export function LinkedInSidebarBox({ tokenStatus }: Props) {
  const { user, refreshUser } = useAuth();
  const t = useT();
  const router = useRouter();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const linkedinData = user?.rawData?.linkedinConnection as {
    name?: string;
    picture?: string;
  } | undefined;

  const isConnected = tokenStatus.status !== 'not_connected';
  const isTokenValid = tokenStatus.status === 'valid';
  const isExpiringSoon = tokenStatus.status === 'expiring_soon';
  const isExpired = tokenStatus.status === 'expired';

  const handleConnect = async () => {
    if (!user?.uid) return;
    setIsConnecting(true);
    try {
      const token = await getAuthToken();
      const result = await getLinkedInAuthUrl(token, user.uid);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      } else if (result.url) {
        window.location.href = result.url;
        return; // page is navigating
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível iniciar a conexão.' });
    }
    setIsConnecting(false);
  };

  const handleDisconnect = async () => {
    if (!user?.uid) return;
    setIsDisconnecting(true);
    try {
      const token = await getAuthToken();
      const result = await disconnectLinkedIn(token, user.uid);
      if (result.error) {
        toast({ variant: 'destructive', title: 'Erro', description: result.error });
      } else {
        toast({ title: 'LinkedIn desconectado' });
        // refreshUser() re-fetcha o doc do user no Firestore (sem
        // linkedinConnection) e atualiza o AuthContext. useAuthGuard reage
        // à mudança e recalcula tokenStatus, fazendo o box voltar pro
        // estado "Conecte seu LinkedIn" sem precisar de refresh manual.
        // Antes só chamávamos router.refresh(), que invalida server
        // components mas não toca o estado em memória do client context.
        await refreshUser();
        // Mantém router.refresh() pra invalidar caches de server components
        // que possam estar lendo linkedinConnection (calendário, feed, etc).
        router.refresh();
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível desconectar.' });
    }
    setIsDisconnecting(false);
  };

  // ── Not connected state ──
  if (!isConnected) {
    return (
      <div className="mx-2 mb-2 group-data-[state=collapsed]:mx-0 group-data-[state=collapsed]:mb-1">
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="w-full flex items-center gap-2.5 rounded-lg border border-[#0A66C2]/30 bg-white dark:bg-gray-900 px-3 py-2.5 text-left hover:border-[#0A66C2]/60 hover:bg-[#0A66C2]/5 transition-colors group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-2"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#0A66C2]/20 bg-[#0A66C2]/5">
            <Linkedin className="h-4 w-4 text-[#0A66C2]" />
          </div>
          <div className="flex flex-col group-data-[state=collapsed]:hidden overflow-hidden">
            {isConnecting ? (
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Conectando...
              </span>
            ) : (
              <>
                <span className="text-xs font-medium text-[#0A66C2]">Conecte seu LinkedIn</span>
                <span className="text-[10px] text-muted-foreground">Para publicar conteúdo</span>
              </>
            )}
          </div>
        </button>
      </div>
    );
  }

  // ── Connected state ──
  const borderClass = isExpired
    ? 'border-red-300 dark:border-red-800'
    : isExpiringSoon
      ? 'border-amber-300 dark:border-amber-800'
      : 'border-[#0A66C2]/30';

  const bgClass = isExpired
    ? 'bg-red-50/50 dark:bg-red-950/10'
    : isExpiringSoon
      ? 'bg-amber-50/50 dark:bg-amber-950/10'
      : 'bg-white dark:bg-gray-900';

  return (
    <div className="mx-2 mb-2 group-data-[state=collapsed]:mx-0 group-data-[state=collapsed]:mb-1">
      <div className={`rounded-lg border ${borderClass} ${bgClass} overflow-hidden`}>
        {/* Main box */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-2">
          {/* Avatar or LinkedIn icon */}
          <div className="relative shrink-0">
            {linkedinData?.picture ? (
              <Avatar className="h-8 w-8 border-2 border-[#0A66C2]/30">
                <AvatarImage src={linkedinData.picture} alt={linkedinData.name || ''} />
                <AvatarFallback className="bg-[#0A66C2]/10 text-[#0A66C2] text-xs">
                  {linkedinData.name?.[0]?.toUpperCase() || 'L'}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#0A66C2]/30 bg-[#0A66C2]/5">
                <Linkedin className="h-4 w-4 text-[#0A66C2]" />
              </div>
            )}
            {/* Small LinkedIn badge */}
            <div className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0A66C2] border border-white dark:border-gray-900">
              <Linkedin className="h-2 w-2 text-white" />
            </div>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0 group-data-[state=collapsed]:hidden">
            {isTokenValid && (
              <>
                <p className="text-xs font-medium truncate">{linkedinData?.name || 'LinkedIn'}</p>
                <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">Conectado</p>
              </>
            )}
            {isExpiringSoon && (
              <>
                <p className="text-xs font-medium truncate">{linkedinData?.name || 'LinkedIn'}</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Expira em {tokenStatus.daysLeft}d
                </p>
              </>
            )}
            {isExpired && (
              <>
                <p className="text-[10px] text-red-600 dark:text-red-400 font-medium flex items-center gap-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Reconecte seu LinkedIn
                </p>
              </>
            )}
          </div>
        </div>

        {/* Action buttons for expired/expiring */}
        {(isExpired || isExpiringSoon) && (
          <div className="px-2.5 pb-2 group-data-[state=collapsed]:hidden">
            <Button
              size="sm"
              variant="outline"
              className={`w-full h-7 text-[11px] gap-1 ${
                isExpired
                  ? 'border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400'
                  : 'border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400'
              }`}
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ExternalLink className="h-3 w-3" />
              )}
              Reconectar
            </Button>
          </div>
        )}

        {/* Disconnect option (only when valid, subtle) */}
        {isTokenValid && (
          <div className="px-2.5 pb-2 group-data-[state=collapsed]:hidden">
            <button
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="w-full flex items-center justify-center gap-1 text-[10px] text-muted-foreground/60 hover:text-red-500 transition-colors py-0.5"
            >
              {isDisconnecting ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
              ) : (
                <Unlink className="h-2.5 w-2.5" />
              )}
              Desconectar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
