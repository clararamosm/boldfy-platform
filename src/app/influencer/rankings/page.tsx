import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const RankingPodium = ({ rank, name, points, avatarSrc, avatarFallback, highlight = false }) => (
    <Card className={`flex flex-col items-center p-4 text-center ${highlight ? 'bg-secondary' : ''}`}>
        <div className="relative">
            <Avatar className="w-20 h-20 border-4 border-primary">
                <AvatarImage src={avatarSrc} data-ai-hint="person avatar" />
                <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
            {rank === 1 && <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 h-8 w-8 text-yellow-500" />}
        </div>
        <h3 className="mt-4 font-semibold text-lg">{name}</h3>
        <p className="text-muted-foreground font-bold text-primary">{points.toLocaleString()} pts</p>
        {highlight && <Badge className="mt-2">Você</Badge>}
    </Card>
);

export default function InfluencerRankingsPage() {
  return (
    <>
      <Header title="Rankings" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
             <RankingPodium 
                rank={2}
                name="João Paulo"
                points={890}
                avatarSrc="https://placehold.co/80x80.png"
                avatarFallback="JP"
             />
             <RankingPodium 
                rank={1}
                name="Carla Costa"
                points={1250}
                avatarSrc="https://placehold.co/80x80.png"
                avatarFallback="CC"
             />
            <RankingPodium 
                rank={3}
                name="Você"
                points={750}
                avatarSrc="https://placehold.co/80x80.png"
                avatarFallback="U"
                highlight
             />
        </div>

        <Card>
            <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-muted-foreground" />
                    Ranking Geral
                </CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Posição</TableHead>
                            <TableHead>Colaborador</TableHead>
                            <TableHead className="text-right">Pontos</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow className="bg-secondary">
                             <TableCell className="font-medium">3º</TableCell>
                             <TableCell>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src="https://placehold.co/40x40.png" data-ai-hint="person avatar" />
                                        <AvatarFallback>U</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">Você</span>
                                </div>
                             </TableCell>
                             <TableCell className="text-right font-semibold">750</TableCell>
                        </TableRow>
                        <TableRow>
                             <TableCell className="font-medium">4º</TableCell>
                             <TableCell>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src="https://placehold.co/40x40.png" data-ai-hint="person avatar" />
                                        <AvatarFallback>RM</AvatarFallback>
                                    </Avatar>
                                    <span>Ricardo Mendes</span>
                                </div>
                             </TableCell>
                             <TableCell className="text-right">620</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </main>
    </>
  );
}
