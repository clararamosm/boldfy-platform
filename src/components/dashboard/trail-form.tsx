// src/components/dashboard/trail-form.tsx
'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Textarea } from "@/components/ui/textarea";
import { FileVideo, Plus, Trash2 } from "lucide-react";

export type Trail = {
  name: string;
  status: 'Ativa' | 'Inativa';
  enrolled?: number;
  total?: number;
  topics?: number;
  companies?: number;
  creationDate?: string;
  description?: string;
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

export const TrailForm = ({ trail }: { trail?: Trail }) => {
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
            <Textarea id="trail-description" placeholder="Descreva o objetivo da trilha de aprendizagem." defaultValue={trail?.description || "Prepare novos colaboradores para se tornarem advogados da marca."} />
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
                <CardContent className="p-0">
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
                </CardContent>
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
                    <CardContent className="p-0">
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
                    </CardContent>
                 </Card>
            ))}
        </div>
      </div>
    </div>
  );
};
