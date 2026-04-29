'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/dashboard/header';
import { AnalyticsDashboard } from '@/components/linkedin-analytics/analytics-dashboard';
import { getAuthToken } from '@/lib/auth-client';
import { getCompanyAnalyticsUsers } from '@/app/actions/linkedin-analytics';
import type { AnalyticsUser } from '@/lib/linkedin-analytics-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, AlertCircle } from 'lucide-react';

const MONTH_NAMES_PT: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

function formatLastUpload(mesAno?: string): string {
  if (!mesAno) return 'Nunca fez upload';
  const [year, month] = mesAno.split('-');
  return `Último upload: ${MONTH_NAMES_PT[month] ?? month}/${year}`;
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

export default function AdminTLAnalyticsPage() {
  const [users, setUsers] = useState<AnalyticsUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const token = await getAuthToken();
        const result = await getCompanyAnalyticsUsers(token, 'thoughtleader');
        if (result.error) {
          setError(result.error);
        } else {
          setUsers(result.users ?? []);
          if (result.users?.length) setSelectedUserId(result.users[0].id);
        }
      } catch (e) {
        setError('Erro ao carregar thought leaders.');
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const selectedUser = users.find(u => u.id === selectedUserId);
  const currentMonth = new Date().toISOString().substring(0, 7);
  const uploadPending = selectedUser
    ? (!selectedUser.lastUploadMonth || selectedUser.lastUploadMonth < currentMonth)
    : false;

  return (
    <div className="flex flex-col h-full">
      <Header title="Analytics — Thought Leaders" />
      <div className="flex-1 overflow-auto p-6 space-y-6">

        {/* Filtro de TL */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground shrink-0">Visualizando:</span>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando thought leaders...
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-sm text-red-500">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          ) : users.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum thought leader com analytics disponível.</p>
          ) : (
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Selecionar thought leader" />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={u.avatarUrl} />
                        <AvatarFallback className="text-[9px]">{getInitials(u.name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Aviso de upload pendente */}
        {uploadPending && selectedUser && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>{selectedUser.name}</strong> ainda não fez o upload do relatório deste mês.
              {selectedUser.lastUploadMonth && (
                <span className="text-amber-600 ml-1">({formatLastUpload(selectedUser.lastUploadMonth)})</span>
              )}
            </p>
          </div>
        )}

        {/* Dashboard — com plano de ação (read-only) e ICP-Fit */}
        {selectedUserId && !loading && (
          <AnalyticsDashboard
            userId={selectedUserId}
            userName={selectedUser?.name}
            role="admin"
            showActionPlan={true}
            readOnlyActionPlan={true}
            showIcpScore={true}
            showMediaValue={true}
            uploadPending={false}
          />
        )}
      </div>
    </div>
  );
}
