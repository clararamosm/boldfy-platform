// src/app/admin/trilhas/page.tsx
'use client';

import React, { useState } from 'react';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, PlusCircle, Globe, Trash2, Upload, FileVideo, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ActionDialog } from "@/components/dashboard/action-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type Trail = {
  name: string;
  status: 'Ativa' | 'Inativa';
  enrolled: number;
  total: number;
};

type Topic = {
  id: number;
  title: string;
  description: string;
  videoFile: File | null;
};

type QuizQuestion = {
    id: number;
    question: string;
    options: string[];
    correctAnswer: number;
};


const trails: Trail[] = [
  { name: "Onboarding de Novos Influenciadores", status: "Ativa", enrolled: 45, total: 45 },
];

const TrailForm = ({ trail }: { trail?: Trail }) => {
  const [topics, setTopics] = useState<Topic[]>([
    { id: 1, title: 'Bem-vindo à Boldfy!', description: 'Conheça nossa missão, visão e valores.', videoFile: null },
  ]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([
    { id: 1, question: 'Qual é o principal objetivo da nossa plataforma?', options: ['Vender produtos', 'Engajar colaboradores', 'Fazer amigos', 'Postar fotos'], correctAnswer: 1 },
  ]);

  const addTopic = () => {
    setTopics([...topics, { id: Date.now(), title: '', description: '', videoFile: null }]);
  };

  const removeTopic = (id: number) => {
    setTopics(topics.filter(topic => topic.id !== id));
  };
  
  const addQuestion = () => {
    setQuestions([...questions, { id: Date.now(), question: '', options: ['', '', '', ''], correctAnswer: 0 }]);
  };

  const removeQuestion = (id: number) => {
    setQuestions(questions.filter(q => q.id !== id));
  };


  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-4 -mr-4">
      {/* Informações Básicas */}
      <div className="space-y-4">
         <div className="space-y-2">
            <Label htmlFor="trail-name" className="font-bold text-base">Nome da Trilha</Label>
            <Input id="trail-name" placeholder="Ex: Onboarding de Novos Influenciadores" defaultValue={trail?.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="trail-description" className="font-bold text-base">Descrição</Label>
            <Textarea id="trail-description" placeholder="Descreva o objetivo da trilha de aprendizagem." defaultValue="Prepare novos colaboradores para se tornarem advogados da marca." />
          </div>
      </div>
      
      <Separator />

      {/* Tópicos */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold">Tópicos</h3>
          <Button type="button" variant="outline" size="sm" onClick={addTopic}><Plus className="mr-2 h-4 w-4" />Adicionar Tópico</Button>
        </div>
        
        <div className="space-y-4">
          {topics.map((topic, index) => (
            <Card key={topic.id} className="p-4 bg-muted/50">
              <div className="flex justify-between items-center mb-4">
                 <h4 className="font-semibold">Tópico {index + 1}</h4>
                 <Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeTopic(topic.id)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-3">
                 <Input placeholder="Título do tópico" defaultValue={topic.title} />
                 <Textarea placeholder="Descrição longa do tópico..." rows={4} defaultValue={topic.description} />
                 <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm text-muted-foreground"><FileVideo className="h-4 w-4" />Vídeo do Tópico</Label>
                    <Input type="file" accept="video/*" className="text-xs" />
                 </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

       <Separator />

      {/* Quiz */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold">Quiz</h3>
            <Button type="button" variant="outline" size="sm" onClick={addQuestion}><Plus className="mr-2 h-4 w-4" />Adicionar Pergunta</Button>
        </div>

        <div className="space-y-4">
            {questions.map((q, qIndex) => (
                 <Card key={q.id} className="p-4 bg-muted/50">
                     <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold">Pergunta {qIndex + 1}</h4>
                        <Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeQuestion(q.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                     <div className="space-y-3">
                        <Textarea placeholder="Qual é a pergunta?" defaultValue={q.question} />
                        <RadioGroup defaultValue={q.correctAnswer.toString()}>
                            {q.options.map((opt, oIndex) => (
                                <div key={oIndex} className="flex items-center gap-2">
                                    <RadioGroupItem value={oIndex.toString()} id={`q${q.id}-opt${oIndex}`} />
                                    <Label htmlFor={`q${q.id}-opt${oIndex}`} className="flex-1">
                                         <Input placeholder={`Opção ${oIndex + 1}`} defaultValue={opt} className="w-full"/>
                                    </Label>
                                </div>
                            ))}
                        </RadioGroup>
                        <p className="text-xs text-muted-foreground">Marque a opção que representa a resposta correta.</p>
                     </div>
                 </Card>
            ))}
        </div>
      </div>

    </div>
  );
};

const EditTrailButton = ({ trail }: { trail: Trail }) => (
  <ActionDialog
    title="Editar Trilha de Aprendizagem"
    description="Altere o conteúdo da sua trilha, adicione tópicos, vídeos e edite o quiz."
    trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Editar Conteúdo</DropdownMenuItem>}
    actionText="Salvar Alterações"
  >
    <TrailForm trail={trail} />
  </ActionDialog>
);

const ProgressView = () => (
  <div className="space-y-4">
      <div className="flex items-center gap-3">
           <Avatar>
              <AvatarImage src="https://placehold.co/40x40.png" data-ai-hint="person avatar" />
              <AvatarFallback>CC</AvatarFallback>
          </Avatar>
          <div className="flex-1">
              <p className="font-medium text-sm">Carla Costa</p>
              <Progress value={100} className="h-2 mt-1" />
          </div>
          <span className="text-sm font-semibold">100%</span>
      </div>
      <div className="flex items-center gap-3">
           <Avatar>
              <AvatarImage src="https://placehold.co/40x40.png" data-ai-hint="person avatar" />
              <AvatarFallback>JP</AvatarFallback>
          </Avatar>
          <div className="flex-1">
              <p className="font-medium text-sm">João Paulo</p>
              <Progress value={75} className="h-2 mt-1" />
          </div>
          <span className="text-sm font-semibold">75%</span>
      </div>
  </div>
);

 const ViewProgressButton = () => (
  <ActionDialog
    title="Progresso da Trilha"
    description="Acompanhe o progresso dos colaboradores nesta trilha."
    trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Ver Progresso</DropdownMenuItem>}
    actionText="Fechar"
    showCancel={false}
  >
    <ProgressView />
  </ActionDialog>
);


export default function AdminTrilhasPage() {
  const createTrailButton = (
    <Button size="sm">
      <PlusCircle className="mr-2 h-4 w-4" />
      Criar Trilha
    </Button>
  );

  return (
    <>
      <Header title="Trilhas de Aprendizagem" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <Tabs defaultValue="personalizadas">
          <div className="flex items-center justify-between mb-4">
            <TabsList>
              <TabsTrigger value="personalizadas">Trilhas Personalizadas</TabsTrigger>
              <TabsTrigger value="globais">Trilhas Globais</TabsTrigger>
            </TabsList>
             <ActionDialog
              title="Criar Trilha Personalizada"
              description="Crie uma nova trilha de aprendizagem para sua equipe com tópicos, vídeos e quizzes."
              trigger={createTrailButton}
              actionText="Salvar Trilha"
            >
              <TrailForm />
            </ActionDialog>
          </div>
          <TabsContent value="personalizadas">
            <Card>
              <CardHeader>
                <CardTitle>Suas Trilhas Personalizadas</CardTitle>
                <CardDescription>Crie e gerencie trilhas de aprendizagem para sua equipe.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Inscritos</TableHead>
                      <TableHead><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trails.map((trail) => (
                        <TableRow key={trail.name}>
                          <TableCell className="font-medium">{trail.name}</TableCell>
                          <TableCell><Badge variant={trail.status === 'Ativa' ? 'default' : 'outline'}>{trail.status}</Badge></TableCell>
                          <TableCell>{trail.enrolled} / {trail.total}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <EditTrailButton trail={trail} />
                                <ViewProgressButton />
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>{trail.status === 'Ativa' ? 'Desativar' : 'Ativar'}</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="globais">
             <Card>
              <CardHeader>
                <CardTitle>Trilhas de Aprendizagem Globais</CardTitle>
                <CardDescription>Ative ou desative trilhas padrão para seus colaboradores.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome da Trilha</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                           <Globe className="h-4 w-4 text-muted-foreground" />
                           Cultura da Empresa 101
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex items-center space-x-2">
                            <Switch id="cultura-switch" defaultChecked />
                            <Label htmlFor="cultura-switch">Ativa</Label>
                        </div>
                      </TableCell>
                    </TableRow>
                     <TableRow>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                           <Globe className="h-4 w-4 text-muted-foreground" />
                           Dominando Nossos Produtos
                        </div>
                      </TableCell>
                      <TableCell>
                         <div className="flex items-center space-x-2">
                            <Switch id="produtos-switch" />
                            <Label htmlFor="produtos-switch">Inativa</Label>
                        </div>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

    