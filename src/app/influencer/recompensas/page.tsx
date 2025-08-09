// src/app/influencer/recompensas/page.tsx
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Gift, History, Zap, PlusCircle, MinusCircle, Award, TrendingUp, TrendingDown } from "lucide-react";
import Image from "next/image";

const RewardCard = ({ title, points }) => (
    <Card>
        <CardHeader className="p-0">
            <div className="aspect-video bg-muted flex items-center justify-center rounded-t-lg overflow-hidden">
                <Gift className="h-12 w-12 text-muted-foreground" />
            </div>
        </CardHeader>
        <CardContent className="p-4">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
             <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap shrink-0">
                <Zap className="h-3 w-3 mr-1"/>
                {points.toLocaleString()}
            </Badge>
            <Button>Resgatar</Button>
        </CardFooter>
    </Card>
)

const PointHistoryItem = ({ icon, title, date, points, type }) => (
     <div className="flex justify-between items-center p-3 rounded-lg hover:bg-muted/50">
        <div className="flex items-center gap-3">
            {icon}
            <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{date}</p>
            </div>
        </div>
         <Badge variant="secondary" className={`${type === 'gain' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'} whitespace-nowrap shrink-0`}>
            <Zap className="h-3 w-3 mr-1"/>
            {type === 'gain' ? '+' : '-'}{points.toLocaleString()}
        </Badge>
    </div>
)

export default function InfluencerRecompensasPage() {
  return (
    <>
      <Header title="Recompensas" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
         <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <Card>
                <CardContent className="p-4 flex flex-col">
                    <Zap className="h-6 w-6 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">Pontos Disponíveis</p>
                    <p className="text-2xl font-bold font-headline">1.250</p>
                </CardContent>
            </Card>
             <Card>
                <CardContent className="p-4 flex flex-col">
                    <TrendingDown className="h-6 w-6 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">Pontos Gastos</p>
                    <p className="text-2xl font-bold font-headline">5.000</p>
                </CardContent>
            </Card>
             <Card>
                <CardContent className="p-4 flex flex-col">
                    <Award className="h-6 w-6 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">Prêmios Resgatados</p>
                    <p className="text-2xl font-bold font-headline">1</p>
                </CardContent>
            </Card>
        </div>

        <Tabs defaultValue="loja">
            <TabsList>
                <TabsTrigger value="loja">Loja</TabsTrigger>
                <TabsTrigger value="meus-resgates">Meus Resgates</TabsTrigger>
                <TabsTrigger value="historico-pontos">Histórico de Pontos</TabsTrigger>
            </TabsList>
            <TabsContent value="loja" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <RewardCard title="Vale-presente iFood R$50" points={5000} />
                    <RewardCard title="Day Off" points={10000} />
                </div>
            </TabsContent>
            <TabsContent value="meus-resgates" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline flex items-center gap-2">
                           <History className="h-5 w-5 text-muted-foreground" />
                           Meus Resgates
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-between items-center p-3 rounded-lg hover:bg-muted/50">
                            <div>
                                <p className="font-medium">Vale-presente iFood R$50</p>
                                <p className="text-sm text-muted-foreground">10 de Julho, 2024</p>
                            </div>
                            <Badge variant="destructive">Pendente</Badge>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
             <TabsContent value="historico-pontos" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline flex items-center gap-2">
                           <History className="h-5 w-5 text-muted-foreground" />
                           Histórico de Pontos
                        </CardTitle>
                         <CardDescription>Acompanhe aqui seus pontos ganhos e gastos.</CardDescription>
                    </CardHeader>
                    <CardContent className="divide-y divide-border -mt-2">
                       <PointHistoryItem 
                            icon={<PlusCircle className="h-6 w-6 text-green-500" />}
                            title="Completou Trilha: Onboarding de Novos Influenciadores"
                            date="15 de Julho, 2024"
                            points={500}
                            type="gain"
                       />
                       <PointHistoryItem 
                            icon={<PlusCircle className="h-6 w-6 text-green-500" />}
                            title="Completou Missão: Atualize seu banner do LinkedIn"
                            date="14 de Julho, 2024"
                            points={50}
                            type="gain"
                       />
                       <PointHistoryItem 
                            icon={<MinusCircle className="h-6 w-6 text-destructive" />}
                            title="Resgate: Vale-presente iFood R$50"
                            date="10 de Julho, 2024"
                            points={5000}
                            type="spend"
                       />
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
