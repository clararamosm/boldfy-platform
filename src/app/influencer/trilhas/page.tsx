// src/app/influencer/trilhas/page.tsx
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Star, Zap, Globe, Building } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const TrailCard = ({ id, title, points, bonus, progress, tasksCompleted, tasksTotal, type, buttonText = "Ver conteúdo", buttonVariant = "default" }) => (
    <Card className="shadow-sm">
        <CardContent className="p-4">
            <div className="flex justify-between items-start mb-2 gap-2">
                <div>
                     <Badge variant="outline" className="mb-2 font-normal">
                        {type === 'global' ? <Globe className="h-3 w-3 mr-1.5" /> : <Building className="h-3 w-3 mr-1.5" />}
                        {type === 'global' ? 'Global' : 'Personalizada'}
                    </Badge>
                    <h3 className="font-semibold">{title}</h3>
                </div>
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 flex-shrink-0">
                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                        <Zap className="h-3 w-3 mr-1"/>
                        {points} pts
                    </Badge>
                     <Badge variant="secondary" className="bg-yellow-400/10 text-yellow-500 hover:bg-yellow-400/20">
                        <Star className="h-3 w-3 mr-1"/>
                        {bonus} bônus
                    </Badge>
                </div>
            </div>
            <div className="flex justify-between items-center text-sm text-muted-foreground mb-2">
                <span>Progresso</span>
                <span>{tasksCompleted}/{tasksTotal}</span>
            </div>
            <Progress value={progress} />
             <div className="mt-4">
                <Button variant={buttonVariant} className="w-full sm:w-auto" asChild>
                    <Link href={`/influencer/trilhas/${id}`}>{buttonText}</Link>
                </Button>
            </div>
        </CardContent>
    </Card>
);

export default function TrilhasPage() {
  return (
    <>
      <Header title="Trilhas de Aprendizagem" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <Card>
            <CardContent className="grid gap-4 md:grid-cols-2 p-4">
                <div className="p-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                        <Zap className="h-4 w-4"/>
                        Pontos por trilhas
                    </div>
                    <div className="text-3xl font-bold">750</div>
                </div>
                <div className="p-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                        <Star className="h-4 w-4"/>
                        Pontos bônus
                    </div>
                    <div className="text-3xl font-bold">150</div>
                </div>
            </CardContent>
        </Card>
        
        <div className="space-y-4">
            <h2 className="text-xl font-bold font-headline">Minhas Trilhas</h2>
             <TrailCard 
                id="onboarding"
                title="Onboarding de Novos Influenciadores" 
                points={500} 
                bonus={100} 
                progress={100}
                tasksCompleted={2}
                tasksTotal={2}
                buttonText="Revisar conteúdo"
                buttonVariant="secondary"
                type="personalizada"
            />
            <TrailCard 
                id="cultura"
                title="Cultura da Empresa 101" 
                points={500} 
                bonus={100} 
                progress={75}
                tasksCompleted={3}
                tasksTotal={4}
                buttonText="Continuar"
                buttonVariant="default"
                type="global"
            />
        </div>
      </main>
    </>
  );
}
