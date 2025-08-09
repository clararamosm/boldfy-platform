// src/app/influencer/trilhas/[id]/page.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle, Video, FileText, ChevronRight, ChevronLeft, Award } from "lucide-react";
import Link from 'next/link';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

const mockTrailData = {
    title: "Onboarding de Novos Influenciadores",
    topics: [
        { id: 'topic1', title: 'Bem-vindo à Boldfy!', type: 'video', content: 'Conheça nossa missão, visão e valores, e como você pode se tornar um advogado da marca de sucesso.', videoUrl: 'https://placehold.co/1280x720.png' },
        { id: 'topic2', title: 'Entendendo a Plataforma', type: 'video', content: 'Um tour completo pelas funcionalidades da plataforma Brand Advocate Hub.', videoUrl: 'https://placehold.co/1280x720.png' },
    ],
    quiz: {
        id: 'quiz1',
        title: 'Quiz Final',
        questions: [
            { id: 'q1', text: 'Qual é o principal objetivo da nossa plataforma?', options: ['Vender produtos', 'Engajar colaboradores', 'Fazer amigos', 'Postar fotos'], correctAnswer: 'Engajar colaboradores' },
            { id: 'q2', text: 'O que são as missões?', options: ['Tarefas para ganhar pontos', 'Reuniões semanais', 'Férias coletivas', 'Nenhuma das anteriores'], correctAnswer: 'Tarefas para ganhar pontos' },
        ]
    }
};

const TopicNavItem = ({ topic, isActive, onClick, isCompleted }) => (
    <button
        onClick={onClick}
        className={`flex w-full items-center justify-between text-left p-3 rounded-lg border transition-colors ${isActive ? 'bg-muted border-primary' : 'hover:bg-muted'}`}
    >
        <div className="flex items-center gap-3">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full ${isCompleted ? 'bg-primary text-primary-foreground' : 'bg-gray-200'}`}>
                {isCompleted ? <CheckCircle className="h-4 w-4" /> : (topic.type === 'video' ? <Video className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />)}
            </div>
            <span className="font-medium">{topic.title}</span>
        </div>
        <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${isActive ? 'translate-x-1' : ''}`} />
    </button>
);

const QuizNavItem = ({ quiz, isActive, onClick, isCompleted }) => (
     <button
        onClick={onClick}
        className={`flex w-full items-center justify-between text-left p-3 rounded-lg border transition-colors ${isActive ? 'bg-muted border-primary' : 'hover:bg-muted'}`}
    >
        <div className="flex items-center gap-3">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full ${isCompleted ? 'bg-primary text-primary-foreground' : 'bg-gray-200'}`}>
                {isCompleted ? <CheckCircle className="h-4 w-4" /> : <Award className="h-4 w-4 text-muted-foreground" />}
            </div>
            <span className="font-medium">{quiz.title}</span>
        </div>
        <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${isActive ? 'translate-x-1' : ''}`} />
    </button>
);

export default function TrailDetailPage({ params }: { params: { id: string } }) {
    const [activeItem, setActiveItem] = useState(mockTrailData.topics[0]);
    const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());
    const [quizAnswers, setQuizAnswers] = useState({});
    const [quizSubmitted, setQuizSubmitted] = useState(false);

    const allItems = [...mockTrailData.topics, mockTrailData.quiz];
    const activeIndex = allItems.findIndex(item => item.id === activeItem.id);

    const progress = useMemo(() => (completedItems.size / allItems.length) * 100, [completedItems, allItems.length]);

    const handleItemCompletion = () => {
        setCompletedItems(prev => new Set(prev).add(activeItem.id));
        if (activeIndex < allItems.length - 1) {
            setActiveItem(allItems[activeIndex + 1]);
        }
    };
    
    const handleQuizSubmit = () => {
        setQuizSubmitted(true);
        const correctAnswers = mockTrailData.quiz.questions.filter(q => quizAnswers[q.id] === q.correctAnswer).length;
        if(correctAnswers === mockTrailData.quiz.questions.length) {
            handleItemCompletion();
        }
    }
    
    const goToNext = () => {
        if (activeIndex < allItems.length - 1) {
            setActiveItem(allItems[activeIndex + 1]);
        }
    }
    
    const goToPrev = () => {
         if (activeIndex > 0) {
            setActiveItem(allItems[activeIndex - 1]);
        }
    }

    return (
        <>
            <Header title={mockTrailData.title}>
                 <Button variant="outline" asChild>
                    <Link href="/influencer/trilhas">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Voltar para Trilhas
                    </Link>
                </Button>
            </Header>
            <main className="flex-1 overflow-auto p-4 md:p-6">
                <div className="grid gap-8 md:grid-cols-[280px_1fr]">
                    {/* Sidebar de Tópicos */}
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Tópicos</CardTitle>
                                <div className="flex justify-between items-center text-sm text-muted-foreground pt-2">
                                    <span>Progresso</span>
                                    <span>{completedItems.size}/{allItems.length}</span>
                                </div>
                                <Progress value={progress} className="h-2" />
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {mockTrailData.topics.map(topic => (
                                    <TopicNavItem 
                                        key={topic.id} 
                                        topic={topic} 
                                        isActive={activeItem.id === topic.id} 
                                        onClick={() => setActiveItem(topic)}
                                        isCompleted={completedItems.has(topic.id)}
                                    />
                                ))}
                                <QuizNavItem 
                                    quiz={mockTrailData.quiz}
                                    isActive={activeItem.id === mockTrailData.quiz.id} 
                                    onClick={() => setActiveItem(mockTrailData.quiz)}
                                    isCompleted={completedItems.has(mockTrailData.quiz.id)}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Conteúdo do Tópico/Quiz */}
                    <div className="min-w-0">
                        {activeItem.type === 'video' ? (
                            <Card>
                                <CardHeader>
                                    <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                                        <Image src={activeItem.videoUrl} alt={activeItem.title} width={1280} height={720} data-ai-hint="video lesson" className="w-full h-full object-cover" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <h2 className="text-2xl font-bold font-headline mb-2">{activeItem.title}</h2>
                                    <p className="text-muted-foreground">{activeItem.content}</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card>
                                <CardHeader>
                                    <h2 className="text-2xl font-bold font-headline">{mockTrailData.quiz.title}</h2>
                                    <p className="text-muted-foreground">Teste seus conhecimentos para concluir a trilha.</p>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {mockTrailData.quiz.questions.map((q, index) => (
                                        <div key={q.id}>
                                            <p className="font-semibold mb-3">{index + 1}. {q.text}</p>
                                            <RadioGroup
                                                value={quizAnswers[q.id]}
                                                onValueChange={(value) => setQuizAnswers(prev => ({ ...prev, [q.id]: value }))}
                                                disabled={quizSubmitted}
                                            >
                                                {q.options.map(opt => (
                                                    <div key={opt} className={`flex items-center space-x-2 rounded-md border p-3 transition-colors ${quizSubmitted && (opt === q.correctAnswer ? 'border-green-500 bg-green-50' : (quizAnswers[q.id] === opt ? 'border-red-500 bg-red-50' : ''))}`}>
                                                        <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                                                        <Label htmlFor={`${q.id}-${opt}`} className="w-full cursor-pointer">{opt}</Label>
                                                    </div>
                                                ))}
                                            </RadioGroup>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                        
                        <div className="mt-6 flex justify-between items-center">
                            <Button variant="outline" onClick={goToPrev} disabled={activeIndex === 0}>
                                <ChevronLeft className="mr-2 h-4 w-4" /> Anterior
                            </Button>

                            {completedItems.has(activeItem.id) ? (
                                <div className="flex items-center gap-2 text-green-600 font-medium">
                                    <CheckCircle className="h-5 w-5" />
                                    <span>Concluído</span>
                                </div>
                            ) : activeItem.type === 'video' ? (
                                <Button onClick={handleItemCompletion}>Concluir Tópico</Button>
                            ) : (
                                <Button onClick={handleQuizSubmit} disabled={quizSubmitted}>Enviar Respostas</Button>
                            )}

                             <Button variant="outline" onClick={goToNext} disabled={activeIndex === allItems.length - 1}>
                                Próximo <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                         {progress === 100 && (
                            <div className="mt-8 text-center">
                                <Card className="max-w-md mx-auto bg-green-50 border-green-200">
                                    <CardContent className="p-6">
                                        <Award className="h-12 w-12 text-green-600 mx-auto mb-4" />
                                        <h3 className="text-xl font-bold text-green-800">Parabéns!</h3>
                                        <p className="text-green-700">Você concluiu a trilha e ganhou 500 pontos + 100 de bônus!</p>
                                        <Button className="mt-4" asChild>
                                            <Link href="/influencer/trilhas">Voltar para Trilhas</Link>
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </>
    );
}
