import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Gift, History } from "lucide-react";
import Image from "next/image";

const RewardCard = ({ title, points, image, dataAiHint }) => (
    <Card>
        <CardHeader className="p-0">
            <div className="aspect-video bg-muted flex items-center justify-center rounded-t-lg overflow-hidden">
                <Image 
                    src={image}
                    alt={title}
                    width={300}
                    height={168}
                    className="w-full h-full object-cover"
                    data-ai-hint={dataAiHint}
                />
            </div>
        </CardHeader>
        <CardContent className="p-4">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
            <div className="font-bold text-primary">{points.toLocaleString()} pts</div>
            <Button>Resgatar</Button>
        </CardFooter>
    </Card>
)

export default function InfluencerRecompensasPage() {
  return (
    <>
      <Header title="Recompensas" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <Card className="bg-primary text-primary-foreground">
            <CardContent className="p-4 flex justify-between items-center">
                <div>
                    <p className="text-sm">Meus Pontos</p>
                    <p className="text-3xl font-bold font-headline">1,250</p>
                </div>
                <Gift className="h-10 w-10 text-primary-foreground/50"/>
            </CardContent>
        </Card>

        <Tabs defaultValue="loja">
            <TabsList>
                <TabsTrigger value="loja">Loja</TabsTrigger>
                <TabsTrigger value="historico">Meus Resgates</TabsTrigger>
            </TabsList>
            <TabsContent value="loja" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <RewardCard title="Vale-presente iFood R$50" points={5000} image="https://placehold.co/600x400.png" dataAiHint="food voucher" />
                    <RewardCard title="Day Off" points={10000} image="https://placehold.co/600x400.png" dataAiHint="vacation relaxation" />
                </div>
            </TabsContent>
            <TabsContent value="historico" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline flex items-center gap-2">
                           <History className="h-5 w-5 text-muted-foreground" />
                           Histórico de Resgates
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
        </Tabs>
      </main>
    </>
  );
}
