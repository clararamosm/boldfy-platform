// src/components/trilhas/player/module-renderer.tsx
'use client';

import DOMPurify from 'dompurify';
import type React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Play, CheckCircle2, Trophy, AlertCircle,
  Wrench, Target, ChevronRight,
} from 'lucide-react';
import { useT } from '@/lib/i18n/context';
import { interpolate } from '@/lib/i18n';
import type { QuestaoDesafio } from '@/types/trilhas';
import type { MappedModule, QuizScore } from './use-trail-player';

type Props = {
  currentModule: MappedModule;
  moduleCompleted: boolean;
  // Video
  videoRef: React.RefObject<HTMLVideoElement>;
  videoProgress: number;
  onVideoTimeUpdate: () => void;
  // Quiz
  currentQuestionIndex: number;
  selectedAnswers: Record<number, number>;
  answeredQuestions: Set<number>;
  quizSubmitted: boolean;
  quizScore: QuizScore | null;
  alreadyAttempted: boolean;
  onAnswerSelect: (qi: number, oi: number) => void;
  onConfirmAnswer: () => void;
  onNextQuestion: () => void;
  onSubmitDesafio: () => void;
};

export function ModuleRenderer({
  currentModule, moduleCompleted,
  videoRef, videoProgress, onVideoTimeUpdate,
  currentQuestionIndex, selectedAnswers, answeredQuestions,
  quizSubmitted, quizScore, alreadyAttempted,
  onAnswerSelect, onConfirmAnswer, onNextQuestion, onSubmitDesafio,
}: Props) {
  const tp = useT().trailPlayer;

  // ─── AULA (video) ─────────────────────────────
  if (currentModule.tipo === 'aula') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">{currentModule.titulo}</h2>
          {moduleCompleted && (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle2 className="h-3 w-3 mr-1" /> {tp.completed}
            </Badge>
          )}
        </div>

        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          {currentModule.conteudo?.videoUrl ? (
            currentModule.conteudo.videoUrl.includes('youtube') ||
            currentModule.conteudo.videoUrl.includes('youtu.be') ||
            currentModule.conteudo.videoUrl.includes('vimeo') ? (
              <iframe
                src={currentModule.conteudo.videoUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                ref={videoRef}
                src={currentModule.conteudo.videoUrl}
                controls
                className="w-full h-full"
                onTimeUpdate={onVideoTimeUpdate}
              />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/50">
              <Play className="h-16 w-16" />
            </div>
          )}
        </div>

        {!moduleCompleted && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{tp.videoProgress}</span>
              <span>{Math.round(videoProgress)}%</span>
            </div>
            <Progress value={videoProgress} className="h-2" />
            <p className="text-xs text-muted-foreground">{tp.videoMinWatch}</p>
          </div>
        )}
      </div>
    );
  }

  // ─── LEITURA ──────────────────────────────────
  if (currentModule.tipo === 'leitura') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">{currentModule.titulo}</h2>
          {moduleCompleted && (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle2 className="h-3 w-3 mr-1" /> {tp.completed}
            </Badge>
          )}
        </div>
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentModule.conteudo?.texto || `<p>${tp.contentUnavailable}</p>`) }}
        />
      </div>
    );
  }

  // ─── DESAFIO ──────────────────────────────────
  if (currentModule.tipo === 'desafio') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">{currentModule.titulo}</h2>
          {moduleCompleted && (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle2 className="h-3 w-3 mr-1" /> {tp.completed}
            </Badge>
          )}
        </div>

        {alreadyAttempted && !quizSubmitted ? (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-6 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-amber-600 mx-auto" />
              <p className="font-semibold text-amber-800">{tp.scoreAlreadyFixed}</p>
              <p className="text-sm text-amber-700">
                {tp.alreadyAttemptedMsg}
                {quizScore && <strong> {quizScore.percent}% = {quizScore.points} {tp.points}</strong>}
              </p>
              <p className="text-xs text-amber-600">{tp.alreadyAttemptedNote}</p>
            </CardContent>
          </Card>
        ) : quizSubmitted && quizScore ? (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-6 text-center space-y-4">
              <Trophy className="h-10 w-10 text-green-600 mx-auto" />
              <p className="text-xl font-bold text-green-800">{tp.challengeResult}</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-2xl font-bold">{quizScore.correct}/{quizScore.total}</p>
                  <p className="text-xs text-muted-foreground">{tp.correctAnswers}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{quizScore.percent}%</p>
                  <p className="text-xs text-muted-foreground">{tp.percentage}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{quizScore.points}</p>
                  <p className="text-xs text-muted-foreground">{tp.pointsLabel}</p>
                </div>
              </div>
              {quizScore.percent < 60 && (
                <p className="text-sm text-red-600">{tp.belowMinimum}</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <DesafioQuestions
            questions={currentModule.conteudo?.questoes || []}
            currentQuestionIndex={currentQuestionIndex}
            selectedAnswers={selectedAnswers}
            answeredQuestions={answeredQuestions}
            onAnswerSelect={onAnswerSelect}
            onConfirmAnswer={onConfirmAnswer}
            onNextQuestion={onNextQuestion}
            onSubmitDesafio={onSubmitDesafio}
          />
        )}
      </div>
    );
  }

  // ─── FACA VOCE MESMO ──────────────────────────
  if (currentModule.tipo === 'faca_voce_mesmo') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">{currentModule.titulo}</h2>
          {moduleCompleted && (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle2 className="h-3 w-3 mr-1" /> {tp.completed}
            </Badge>
          )}
        </div>
        <Card className="border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Wrench className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-800 mb-2">{tp.practice}</p>
                <p className="text-sm whitespace-pre-wrap">{currentModule.conteudo?.instrucao || tp.followInstructions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground text-center">{tp.noPointsModule}</p>
      </div>
    );
  }

  // ─── MISSAO CONTEUDO ──────────────────────────
  if (currentModule.tipo === 'missao_conteudo') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">{currentModule.titulo}</h2>
          {moduleCompleted && (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle2 className="h-3 w-3 mr-1" /> {tp.missionUnlocked}
            </Badge>
          )}
        </div>
        <Card className="border-blue-200">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Target className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-800 mb-2">{tp.contentMission}</p>
                <p className="text-sm whitespace-pre-wrap">{currentModule.conteudo?.instrucao || ''}</p>
              </div>
            </div>
            {currentModule.conteudo?.exemplos && (
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase mb-2">{tp.examples}</p>
                <p className="text-sm whitespace-pre-wrap">
                  {Array.isArray(currentModule.conteudo.exemplos)
                    ? currentModule.conteudo.exemplos.join('\n')
                    : currentModule.conteudo.exemplos}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground text-center">{tp.noPointsMission}</p>
      </div>
    );
  }

  return null;
}

// ─── Sub-component: Quiz questions ─────────────
function DesafioQuestions({
  questions, currentQuestionIndex, selectedAnswers, answeredQuestions,
  onAnswerSelect, onConfirmAnswer, onNextQuestion, onSubmitDesafio,
}: {
  questions: QuestaoDesafio[];
  currentQuestionIndex: number;
  selectedAnswers: Record<number, number>;
  answeredQuestions: Set<number>;
  onAnswerSelect: (qi: number, oi: number) => void;
  onConfirmAnswer: () => void;
  onNextQuestion: () => void;
  onSubmitDesafio: () => void;
}) {
  const tp = useT().trailPlayer;
  const q = questions[currentQuestionIndex];
  if (!q) return <p>{tp.noQuestions}</p>;

  const isAnswered = answeredQuestions.has(currentQuestionIndex);
  const selectedIdx = selectedAnswers[currentQuestionIndex];
  const isCorrect = selectedIdx === q.respostaCorreta;

  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{interpolate(tp.questionOf, { current: currentQuestionIndex + 1, total: questions.length })}</span>
        <Progress value={((currentQuestionIndex + 1) / questions.length) * 100} className="w-24 h-2" />
      </div>

      <Card>
        <CardContent className="p-6">
          <p className="text-lg font-semibold mb-4">{q.enunciado}</p>
          <div className="space-y-2">
            {q.opcoes?.map((opt: string, oi: number) => {
              let style = 'border-border hover:bg-muted cursor-pointer';
              if (isAnswered) {
                if (oi === q.respostaCorreta) style = 'border-green-500 bg-green-50';
                else if (oi === selectedIdx && oi !== q.respostaCorreta) style = 'border-red-500 bg-red-50';
                else style = 'border-border opacity-50';
              } else if (selectedIdx === oi) {
                style = 'border-primary bg-primary/5';
              }
              return (
                <button
                  key={oi}
                  onClick={() => onAnswerSelect(currentQuestionIndex, oi)}
                  disabled={isAnswered}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${style}`}
                >
                  <span className="text-sm">{opt}</span>
                </button>
              );
            })}
          </div>

          {isAnswered && (
            <div className={`mt-4 p-3 rounded-lg ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className={`text-sm font-semibold ${isCorrect ? 'text-green-800' : 'text-red-800'}`}>
                {isCorrect ? tp.correct : tp.incorrect}
              </p>
              {q.explicacao && (
                <p className="text-sm text-muted-foreground mt-1">{q.explicacao}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        {!isAnswered ? (
          <Button onClick={onConfirmAnswer} disabled={selectedIdx === undefined}>
            {tp.confirmAnswer}
          </Button>
        ) : currentQuestionIndex < questions.length - 1 ? (
          <Button onClick={onNextQuestion}>
            {tp.nextQuestion} <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={onSubmitDesafio}>
            <Trophy className="mr-2 h-4 w-4" /> {tp.viewResult}
          </Button>
        )}
      </div>
    </div>
  );
}
