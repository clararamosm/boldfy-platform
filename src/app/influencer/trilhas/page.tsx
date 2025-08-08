import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Star, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TrailCard = ({ title, points, bonus, progress, tasksCompleted, tasksTotal, isFirst = false }) => (
    <Card className="shadow-sm">
        <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">{title}</h3>
                <div className="flex items-center gap-2">
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
                <Button variant={isFirst ? "secondary" : "default"} className="w-full sm:w-auto">Ver conteúdo</Button>
            </div>
        </CardContent>
    </Card>
);

export default function TrilhasPage() {
  return (
    <>
      <Header title="Trilhas" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <Card>
            <CardContent className="grid gap-4 md:grid-cols-2 p-4">
                <Card className="border-none shadow-none">
                    <CardContent className="p-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                            <Zap className="h-4 w-4"/>
                            Pontos por trilhas
                        </div>
                        <div className="text-3xl font-bold">0</div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-none">
                    <CardContent className="p-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                            <Star className="h-4 w-4"/>
                            Pontos bônus
                        </div>
                        <div className="text-3xl font-bold">0</div>
                    </CardContent>
                </Card>
            </CardContent>
        </Card>
        
        <Card>
            <CardContent className="space-y-4 p-4">
               <TrailCard 
                    title="" 
                    points={0} 
                    bonus={0} 
                    progress={0}
                    tasksCompleted={0}
                    tasksTotal={0}
                    isFirst={true}
                />
                <TrailCard 
                    title="Treinamento brand" 
                    points={400} 
                    bonus={80} 
                    progress={0}
                    tasksCompleted={0}
                    tasksTotal={2}
                />
                 <TrailCard 
                    title="Treinamento brand" 
                    points={400} 
                    bonus={80} 
                    progress={0}
                    tasksCompleted={0}
                    tasksTotal={2}
                />
            </CardContent>
        </Card>
      </main>
    </>
  );
}
