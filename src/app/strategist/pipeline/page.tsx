'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Users } from "lucide-react";
import Link from "next/link";
import { useAuth } from '@/contexts/auth-context';
import { useT } from '@/lib/i18n/context';

type TLSummary = {
  id: string;
  name: string;
  email: string;
  companyId: string;
  companyName: string;
  status: string;
};

export default function StrategistPipelinePage() {
  const { user } = useAuth();
  const t = useT();
  const [thoughtLeaders, setThoughtLeaders] = useState<TLSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const fetchTLs = async () => {
      setIsLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const assignedCompanyIds = userDoc.data()?.assignedCompanies as string[] || [];

        if (assignedCompanyIds.length === 0) {
          setThoughtLeaders([]);
          setIsLoading(false);
          return;
        }

        const allTLs: TLSummary[] = [];

        for (const companyId of assignedCompanyIds) {
          const compDoc = await getDoc(doc(db, 'companies', companyId));
          const companyName = compDoc.data()?.companyName || '';

          const tlQuery = query(
            collection(db, 'users'),
            where('companyId', '==', companyId),
            where('role', '==', 'thoughtleader')
          );
          const tlSnap = await getDocs(tlQuery);

          for (const tlDoc of tlSnap.docs) {
            const data = tlDoc.data();
            allTLs.push({
              id: tlDoc.id,
              name: data.name || data.profile?.name || '',
              email: data.profile?.email || '',
              companyId,
              companyName,
              status: data.status || 'Pendente',
            });
          }
        }

        setThoughtLeaders(allTLs);
      } catch (error) {
        console.error('Error fetching TLs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTLs();
  }, [user?.uid]);

  return (
    <>
      <Header title={t.strategist.pipelineTitle} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4">
          <p className="text-muted-foreground">{t.strategist.pipelineDescription}</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : thoughtLeaders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">{t.strategist.noTLs}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {thoughtLeaders.map(tl => (
              <Card key={tl.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{tl.name}</CardTitle>
                    <Badge variant={tl.status === 'Ativo' ? 'default' : 'secondary'}>
                      {tl.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {tl.companyName} &middot; {tl.email}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link href={`/thoughtleader/backlog?userId=${tl.id}`}>
                      {t.strategist.viewTL}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
