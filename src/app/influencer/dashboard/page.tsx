import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Zap } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const MissionItem = ({ title, points, href }) => (
    <Link href={href} className="flex items-center justify-between p-3 -mx-3 rounded-lg hover:bg-muted transition-colors">
        <span className="font-medium">{title}</span>
        <div className="flex items-center gap-2 text-primary">
            <Zap className="h-4 w-4" />
            <span className="font-bold">{points} pts</span>
        </div>
    </Link>
)

export default function InfluencerDashboardPage() {
  return (
    <>
      <Header title="Dashboard" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="flex flex-col">
            <CardHeader>
              <CardDescription>Meus Pontos</CardDescription>
              <CardTitle className="font-headline text-5xl">1,250</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">+200 pontos esta semana</p>
            </CardContent>
            <CardFooter>
              <Button asChild>
                <Link href="/influencer/recompensas">Resgatar Recompensas</Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className="md:col-span-2 flex flex-col">
            <CardHeader>
              <CardTitle className="font-headline">Missões da Semana</CardTitle>
              <CardDescription>Complete as missões disponíveis para ganhar pontos.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-2">
               <MissionItem title="Compartilhar post no LinkedIn" points={100} href="/influencer/missoes" />
            </CardContent>
            <CardFooter>
              <Button variant="secondary" asChild>
                <Link href="/influencer/missoes">Ver Todas as Missões</Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="font-headline">Trilhas de Aprendizagem Ativas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="mb-2 flex justify-between items-center">
                  <h3 className="font-semibold">Cultura da Empresa 101</h3>
                  <span className="text-sm text-muted-foreground">75% Completo</span>
                </div>
                <Progress value={75} />
                <Button variant="link" size="sm" className="px-0" asChild>
                    <Link href="/influencer/trilhas">Continuar <ArrowRight className="ml-1 h-4 w-4" /></Link>
                </Button>
              </div>
              <div>
                <div className="mb-2 flex justify-between items-center">
                  <h3 className="font-semibold">Dominando Nossos Produtos</h3>
                  <span className="text-sm text-muted-foreground">30% Completo</span>
                </div>
                <Progress value={30} />
                <Button variant="link" size="sm" className="px-0" asChild>
                    <Link href="/influencer/trilhas">Continuar <ArrowRight className="ml-1 h-4 w-4" /></Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
