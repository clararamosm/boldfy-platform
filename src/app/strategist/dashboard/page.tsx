// src/app/strategist/dashboard/page.tsx
'use client';

import { Header } from "@/components/dashboard/header";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function StrategistDashboardPage() {
  return (
    <>
      <Header title="Dashboard" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <BarChart3 className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Em breve: metricas de todos os perfis</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Aqui voce podera visualizar metricas consolidadas de todos os Thought Leaders
              e empresas atribuidas a sua conta, com filtros por perfil e empresa.
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
