import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, PlusCircle, Users, Building2, BookOpen, Globe, LogIn } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Link from "next/link";


const StatCard = ({ title, value, description, icon: Icon }) => (
    <Card>
        <CardHeader className="items-start">
            <Icon className="h-6 w-6 text-muted-foreground mb-2" />
            <CardTitle className="text-sm font-medium h-10">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold font-headline">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

export default function MasterDashboardPage() {
  return (
    <>
      <Header title="Master Dashboard" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
           <StatCard title="Empresas Ativas" value="15" description="+2 novas este mês" icon={Building2} />
           <StatCard title="Colaboradores Totais" value="852" description="Em todas as empresas" icon={Users} />
           <StatCard title="Trilhas Globais" value="5" description="Conteúdos disponíveis" icon={Globe} />
           <StatCard title="Engajamento Médio" value="78%" description="Atividade na plataforma" icon={BookOpen} />
        </div>
      </main>
    </>
  );
}
