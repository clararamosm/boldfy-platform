'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, Users, LogIn } from "lucide-react";
import Link from "next/link";
import { useAuth } from '@/contexts/auth-context';
import { useT } from '@/lib/i18n/context';

type AssignedCompany = {
  id: string;
  companyName: string;
  status: string;
  licenses: number;
  tlLicenses: number;
  tlCount: number;
};

export default function StrategistEmpresasPage() {
  const { user } = useAuth();
  const t = useT();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<AssignedCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    const fetchAssignedCompanies = async () => {
      setIsLoading(true);
      try {
        // Use rawData from auth context (already fetched on login) as primary source.
        // Fallback: re-fetch user doc from Firestore.
        let assignedCompanyIds: string[] = [];
        const rawAssigned = (user.rawData?.assignedCompanies) as string[] | undefined;
        if (rawAssigned && Array.isArray(rawAssigned) && rawAssigned.length > 0) {
          assignedCompanyIds = rawAssigned;
        } else {
          // Fallback: read from Firestore directly
          const userDocSnap = await getDoc(doc(db, 'users', user.uid));
          assignedCompanyIds = (userDocSnap.data()?.assignedCompanies as string[]) || [];
        }

        if (assignedCompanyIds.length === 0) {
          setCompanies([]);
          setIsLoading(false);
          return;
        }

        const companiesList: AssignedCompany[] = [];

        for (const companyId of assignedCompanyIds) {
          const compDoc = await getDoc(doc(db, 'companies', companyId));
          if (compDoc.exists()) {
            const data = compDoc.data();
            // Count TLs in this company
            const tlQuery = query(
              collection(db, 'users'),
              where('companyId', '==', companyId),
              where('role', '==', 'thoughtleader')
            );
            const tlSnap = await getDocs(tlQuery);

            companiesList.push({
              id: companyId,
              companyName: data.companyName || '',
              status: data.status || 'Ativa',
              licenses: data.licenses || 0,
              tlLicenses: data.tlLicenses || 0,
              tlCount: tlSnap.size,
            });
          }
        }

        setCompanies(companiesList);
      } catch (error) {
        console.error('Error fetching assigned companies:', error);
        toast({ variant: 'destructive', title: 'Erro ao buscar empresas atribuídas.' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssignedCompanies();
  }, [user?.uid]);

  return (
    <>
      <Header title={t.strategist.companiesTitle} />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-4">
          <p className="text-muted-foreground">{t.strategist.companiesDescription}</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : companies.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">{t.strategist.noCompanies}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {companies.map(company => (
              <Card key={company.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{company.companyName}</CardTitle>
                    <Badge variant={company.status === 'Ativa' ? 'default' : 'secondary'}>
                      {company.status}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-3 pt-1">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {company.tlCount}/{company.tlLicenses} TLs
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto pt-0">
                  <div className="flex gap-2">
                    <Button asChild size="sm" className="flex-1">
                      <Link href={`/admin/dashboard?companyId=${company.id}`}>
                        <LogIn className="mr-2 h-4 w-4" />
                        {t.strategist.viewCompany}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
