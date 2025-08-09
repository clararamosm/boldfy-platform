import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const MissionCard = ({ title, description, points, status, onAction, actionText }) => (
    <Card>
        <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="font-headline text-lg">{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </div>
                 <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap">
                    +{points} pts
                </Badge>
            </div>
        </CardHeader>
        <CardFooter className="flex justify-between items-center">
            {status === 'completa' ? (
                <div className="text-sm text-green-600 flex items-center font-medium">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Missão Completa
                </div>
            ) : (
                <span/>
            )}
            {status !== 'completa' && (
                <Button onClick={onAction}>
                    {actionText}
                </Button>
            )}
        </CardFooter>
    </Card>
);

export default function InfluencerMissoesPage() {
  return (
    <>
      <Header title="Missões" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Tabs defaultValue="semana">
            <TabsList className="mb-4">
                <TabsTrigger value="semana">Missões da Semana</TabsTrigger>
                <TabsTrigger value="onboarding">Missões Fixas</TabsTrigger>
            </TabsList>
            <TabsContent value="semana">
                <div className="space-y-4">
                    <MissionCard
                        title="Compartilhe o post no LinkedIn"
                        description="Ajude a divulgar nosso último artigo sobre as tendências de IA para 2025."
                        points={100}
                        status="pendente"
                        actionText={
                            <>
                                <Upload className="mr-2 h-4 w-4" /> Enviar Comprovação
                            </>
                        }
                    />
                </div>
            </TabsContent>
             <TabsContent value="onboarding">
                 <div className="space-y-4">
                    <MissionCard
                        title="Atualize seu banner do LinkedIn"
                        description="Use nosso banner oficial para mostrar que você faz parte do time."
                        points={50}
                        status="completa"
                    />
                </div>
            </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
