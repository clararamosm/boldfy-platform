// src/components/trilhas/player/module-renderer.tsx
'use client';

import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkHighlight from '@/lib/remark-highlight';
import type React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Play, CheckCircle2, Trophy, AlertCircle,
  Wrench, Target, ChevronRight, BookOpen,
} from 'lucide-react';
import { CoinIcon } from '@/components/coin-icon';
import { useT } from '@/lib/i18n/context';
import { interpolate } from '@/lib/i18n';
import type { QuestaoDesafio } from '@/types/trilhas';
import type { MappedModule, QuizScore } from './use-trail-player';

// ─── Shared prose styling & DOMPurify config ──────────────
const PROSE_CLASSES = "prose prose-base max-w-none prose-p:leading-relaxed prose-p:mb-7 prose-h1:text-2xl prose-h1:font-bold prose-h1:mt-10 prose-h1:mb-5 prose-h2:text-xl prose-h2:font-bold prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-3 prose-h4:text-base prose-h4:font-medium prose-h4:mt-4 prose-h4:mb-2 prose-li:mb-2 prose-ul:mb-5 prose-ol:mb-5 prose-hr:border-transparent prose-hr:my-8 prose-blockquote:border-l-purple-400 prose-blockquote:bg-purple-50 prose-blockquote:py-3 prose-blockquote:px-5 prose-blockquote:rounded-r-lg prose-blockquote:not-italic [&_mark]:bg-purple-100 [&_mark]:text-inherit [&_mark]:px-0.5 [&_mark]:rounded-sm [&_svg]:max-w-full [&_svg]:mx-auto [&_svg]:block [&_svg]:my-6 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-6 prose-a:text-purple-600 prose-a:underline [&_u]:underline";

const SANITIZE_CONFIG = {
  ADD_TAGS: ['svg', 'path', 'rect', 'circle', 'line', 'text', 'g', 'defs', 'marker', 'polygon', 'polyline', 'ellipse', 'use', 'symbol', 'clipPath', 'linearGradient', 'radialGradient', 'stop', 'foreignObject', 'h2', 'h3', 'strong', 'em', 's', 'u', 'a', 'mark', 'img', 'ul', 'ol', 'li', 'blockquote'],
  ADD_ATTR: ['viewBox', 'xmlns', 'fill', 'stroke', 'stroke-width', 'd', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2', 'points', 'transform', 'opacity', 'rx', 'ry', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'marker-end', 'marker-start', 'refX', 'refY', 'markerWidth', 'markerHeight', 'orient', 'gradientUnits', 'offset', 'stop-color', 'stop-opacity', 'clip-path', 'href', 'class', 'target', 'rel', 'src', 'alt'],
};

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
          <h2 className="text-2xl font-bold mb-1">{currentModule.titulo}</h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <BookOpen className="h-3 w-3 mr-1" /> Leitura
            </Badge>
            {moduleCompleted && (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle2 className="h-3 w-3 mr-1" /> {tp.completed}
              </Badge>
            )}
          </div>
        </div>
        <div
          className={PROSE_CLASSES}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentModule.conteudo?.texto || `<p>${tp.contentUnavailable}</p>`, SANITIZE_CONFIG) }}
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
              <CheckCircle2 className="h-8 w-8 text-amber-600 mx-auto" />
              <p className="font-semibold text-amber-800">Voce ja completou este desafio.</p>
              {quizScore && (
                <p className="text-lg text-amber-700">
                  Sua nota: <strong>{quizScore.percent}%</strong> · Pontos: <strong>{quizScore.points}</strong>
                </p>
              )}
              <p className="text-xs text-amber-600">Voce pode revisar as perguntas, mas a pontuacao nao sera alterada.</p>
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
    const content = currentModule.conteudo?.instrucao || tp.followInstructions;
    const isHtml = content.trim().startsWith('<');
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">{currentModule.titulo}</h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <Wrench className="h-3 w-3 mr-1" /> Pratica
            </Badge>
            {moduleCompleted && (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle2 className="h-3 w-3 mr-1" /> {tp.completed}
              </Badge>
            )}
          </div>
        </div>
        {isHtml ? (
          <div
            className={PROSE_CLASSES}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content, SANITIZE_CONFIG) }}
          />
        ) : (
          <div className={PROSE_CLASSES}>
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkHighlight]}>{content}</ReactMarkdown>
          </div>
        )}
        <p className="text-xs text-muted-foreground text-center">{tp.noPointsModule}</p>
      </div>
    );
  }

  // ─── MISSAO CONTEUDO ──────────────────────────
  if (currentModule.tipo === 'missao_conteudo') {
    const missionPoints = currentModule.missaoGatilho?.pontosRecompensa || 0;
    const missionContent = currentModule.conteudo?.instrucao || '';
    const isMissionHtml = missionContent.trim().startsWith('<');
    const missionProseClasses = "prose prose-sm max-w-none prose-p:text-sm prose-p:leading-relaxed prose-p:mb-6 prose-li:text-sm prose-li:mb-1 prose-ul:mb-4 prose-ol:mb-4 prose-strong:font-semibold prose-hr:border-transparent prose-hr:my-5 prose-h1:text-lg prose-h1:font-bold prose-h1:mt-8 prose-h1:mb-4 prose-h2:text-base prose-h2:font-bold prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-sm prose-h3:font-semibold prose-h3:mt-5 prose-h3:mb-2 prose-h4:text-sm prose-h4:font-medium prose-h4:mt-3 prose-h4:mb-1 prose-blockquote:border-l-blue-400 prose-blockquote:bg-blue-50 prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r prose-blockquote:not-italic [&_mark]:bg-purple-100 [&_mark]:text-inherit [&_mark]:px-0.5 [&_mark]:rounded-sm [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-4 prose-a:text-blue-600 prose-a:underline [&_u]:underline";
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-1">{currentModule.titulo}</h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <Target className="h-3 w-3 mr-1" /> Missao
            </Badge>
            {moduleCompleted && (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle2 className="h-3 w-3 mr-1" /> {tp.missionUnlocked}
              </Badge>
            )}
          </div>
        </div>
        <Card className="border-blue-200">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Target className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-800 mb-2">{tp.contentMission}</p>
                {isMissionHtml ? (
                  <div
                    className={missionProseClasses}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(missionContent, SANITIZE_CONFIG) }}
                  />
                ) : (
                  <div className={missionProseClasses}>
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkHighlight]}>{missionContent}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
            {currentModule.conteudo?.exemplos && (
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase mb-2">{tp.examples}</p>
                <div className="space-y-2">
                  {Array.isArray(currentModule.conteudo.exemplos)
                    ? currentModule.conteudo.exemplos.map((ex: string, i: number) => (
                        <p key={i} className="text-sm text-blue-800 italic">{ex}</p>
                      ))
                    : <p className="text-sm text-blue-800 italic">{currentModule.conteudo.exemplos}</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        {missionPoints > 0 ? (
          <div className="flex items-center justify-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg p-3">
            <CoinIcon className="h-4 w-4 text-yellow-500" />
            <span>Complete a missao em ate 15 dias para ganhar <strong>{missionPoints} pontos</strong></span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center">{tp.noPointsMission}</p>
        )}
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
