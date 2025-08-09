import { Header } from "@/components/dashboard/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Trophy, Gift, BookOpen, Zap, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";


const RankingPodium = ({ rank, name, points, avatarSrc, avatarFallback, highlight = false }) => (
    <Card className={`flex flex-col items-center p-4 text-center ${highlight ? 'bg-secondary' : ''} h-full`}>
        <div className="relative">
            <Avatar className="w-20 h-20 border-4 border-primary">
                <AvatarImage src={avatarSrc} data-ai-hint="person avatar" />
                <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
            {rank === 1 && <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 h-8 w-8 text-yellow-500" />}
        </div>
        <div className="flex flex-col flex-grow justify-center mt-4 items-center">
            <h3 className="font-semibold text-lg">{name}</h3>
             <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap shrink-0 mt-1">
                <Zap className="h-3 w-3 mr-1"/>
                {points.toLocaleString()}
            </Badge>
            <p className="font-bold text-lg mt-1">{rank}º Lugar</p>
        </div>
    </Card>
);

const CategoryRanking = ({ title, icon, data }) => (
    <Card>
        <CardHeader>
            <CardTitle className="font-headline text-base flex items-center gap-2">
                {icon}
                {title}
            </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
            {data.map(item => (
                 <div key={item.name} className="flex items-center gap-3">
                     <Avatar className="h-9 w-9">
                        <AvatarImage src={item.avatarSrc} data-ai-hint="person avatar" />
                        <AvatarFallback>{item.avatarFallback}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <p className="font-medium text-sm">{item.name}</p>
                        <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap shrink-0 font-normal">
                           <Zap className="h-3 w-3 mr-1"/>
                           {item.points.toLocaleString()}
                       </Badge>
                    </div>
                </div>
            ))}
        </CardContent>
    </Card>
);


export default function InfluencerRankingsPage() {
    const missionRankingData = [
        { name: "Carla Costa", points: 800, avatarSrc: "https://placehold.co/40x40.png", avatarFallback: "CC"},
        { name: "Você", points: 450, avatarSrc: "https://placehold.co/40x40.png", avatarFallback: "U"},
        { name: "João Paulo", points: 300, avatarSrc: "https://placehold.co/40x40.png", avatarFallback: "JP"},
    ];

    const trailRankingData = [
         { name: "Você", points: 300, avatarSrc: "https://placehold.co/40x40.png", avatarFallback: "U"},
         { name: "João Paulo", points: 590, avatarSrc: "https://placehold.co/40x40.png", avatarFallback: "JP"},
         { name: "Carla Costa", points: 450, avatarSrc: "https://placehold.co/40x40.png", avatarFallback: "CC"},
    ];

  return (
    <>
      <Header title="Rankings" />
      <main className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-3 items-stretch">
             <RankingPodium 
                rank={1}
                name="Carla Costa"
                points={1250}
                avatarSrc="https://placehold.co/80x80.png"
                avatarFallback="CC"
             />
             <RankingPodium 
                rank={2}
                name="João Paulo"
                points={890}
                avatarSrc="https://placehold.co/80x80.png"
                avatarFallback="JP"
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

        <Card className="bg-primary/10 border-primary/20">
            <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="flex-shrink-0 bg-primary/20 text-primary rounded-full h-12 w-12 flex items-center justify-center">
                        <Gift className="h-6 w-6" />
                    </div>
                    <div className="flex-grow text-center sm:text-left">
                        <p className="font-bold">Prêmio de Agosto: Day Off!</p>
                        <p className="text-sm text-muted-foreground">O top 1 do ranking este mês ganha um dia de folga.</p>
                    </div>
                    <div className="w-full sm:w-48 text-center sm:text-right">
                         <div className="flex items-center justify-center sm:justify-end gap-2 text-xs text-muted-foreground mb-1">
                            <Calendar className="h-3 w-3" />
                            <span>15 de 31 dias</span>
                        </div>
                        <Progress value={(15/31) * 100} className="h-2" />
                    </div>
                </div>
            </CardContent>
        </Card>

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
                         <TableRow>
                             <TableCell className="font-medium w-[80px]">1º</TableCell>
                             <TableCell>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src="https://placehold.co/40x40.png" data-ai-hint="person avatar" />
                                        <AvatarFallback>CC</AvatarFallback>
                                    </Avatar>
                                    <span>Carla Costa</span>
                                </div>
                             </TableCell>
                             <TableCell className="text-right font-semibold">
                                 <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap shrink-0">
                                    <Zap className="h-3 w-3 mr-1"/>
                                    1250
                                </Badge>
                             </TableCell>
                        </TableRow>
                        <TableRow>
                             <TableCell className="font-medium">2º</TableCell>
                             <TableCell>
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src="https://placehold.co/40x40.png" data-ai-hint="person avatar" />
                                        <AvatarFallback>JP</AvatarFallback>
                                    </Avatar>
                                    <span>João Paulo</span>
                                </div>
                             </TableCell>
                             <TableCell className="text-right font-semibold">
                                 <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap shrink-0">
                                    <Zap className="h-3 w-3 mr-1"/>
                                    890
                                </Badge>
                             </TableCell>
                        </TableRow>
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
                             <TableCell className="text-right font-semibold">
                                <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap shrink-0">
                                    <Zap className="h-3 w-3 mr-1"/>
                                    750
                                </Badge>
                             </TableCell>
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
                             <TableCell className="text-right">
                                <Badge variant="secondary" className="bg-primary/10 text-primary whitespace-nowrap shrink-0">
                                    <Zap className="h-3 w-3 mr-1"/>
                                    620
                                </Badge>
                             </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

         <div className="grid gap-6 md:grid-cols-2">
            <CategoryRanking 
                title="Top 3 - Pontos de Missão" 
                icon={<Zap className="h-5 w-5 text-muted-foreground" />}
                data={missionRankingData}
            />
             <CategoryRanking 
                title="Top 3 - Pontos de Trilhas" 
                icon={<BookOpen className="h-5 w-5 text-muted-foreground" />}
                data={trailRankingData}
            />
        </div>
      </main>
    </>
  );
}
