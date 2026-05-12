'use client';

import { useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/context';
import { useTrailPlayer } from '@/components/trilhas/player/use-trail-player';
import { TrailIntroScreen } from '@/components/trilhas/player/trail-intro-screen';
import { TrailConclusionScreen } from '@/components/trilhas/player/trail-conclusion-screen';
import { TrailTopBar } from '@/components/trilhas/player/trail-top-bar';
import { ModuleRenderer } from '@/components/trilhas/player/module-renderer';
import { TrailBottomBar } from '@/components/trilhas/player/trail-bottom-bar';
import { auth } from '@/lib/firebase';
import { completeOnboardingItem } from '@/hooks/use-onboarding';
import { isWorkbookModule } from '@/types/trilhas';

export default function TrilhaFullscreenPage() {
  const { id } = useParams();
  const router = useRouter();
  const tp = useT().trailPlayer;

  const player = useTrailPlayer(id as string);

  // Mark onboarding item when trail is viewed
  const markedRef = useRef(false);
  useEffect(() => {
    if (!player.loading && player.trail && !markedRef.current) {
      markedRef.current = true;
      completeOnboardingItem(auth.currentUser?.uid, 'start-trail');
    }
  }, [player.loading, player.trail]);

  // Loading
  if (player.loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">{tp.loading}</p>
        </div>
      </div>
    );
  }

  // Not found
  if (!player.trail) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-lg font-semibold">{tp.notFound}</p>
          <Button onClick={() => router.push('/colaborador/trilhas')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> {tp.backToTrails}
          </Button>
        </div>
      </div>
    );
  }

  // Intro screen
  if (player.showIntro && !player.showConclusion) {
    return (
      <TrailIntroScreen
        trail={player.trail}
        sortedModules={player.sortedModules}
        isModuleCompleted={player.isModuleCompleted}
        completedCount={player.completedCount}
        totalModules={player.totalModules}
        progressPercent={player.progressPercent}
        onStart={player.startTrail}
        onBack={() => router.push('/colaborador/trilhas')}
      />
    );
  }

  // Conclusion screen
  if (player.showConclusion && player.trail) {
    return (
      <TrailConclusionScreen
        trail={player.trail}
        progress={player.progress}
        onBack={() => router.push('/colaborador/trilhas')}
        onReview={player.enterReviewMode}
        onGoToMissions={() => router.push('/colaborador/missoes')}
      />
    );
  }

  // Module view
  if (!player.currentModule) return null;
  const moduleCompleted = player.isModuleCompleted(player.currentModule.id);

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      <TrailTopBar
        trailTitle={player.trail.titulo}
        currentModule={player.currentModule}
        progressPercent={player.progressPercent}
        reviewMode={player.reviewMode}
        sidebarOpen={player.sidebarOpen}
        saving={player.saving}
        sortedModules={player.sortedModules}
        activeModuleIndex={player.activeModuleIndex}
        isModuleCompleted={player.isModuleCompleted}
        canAccessModule={player.canAccessModule}
        onToggleSidebar={() => player.setSidebarOpen(!player.sidebarOpen)}
        onClose={() => { router.push('/colaborador/trilhas'); }}
        onGoToModule={player.goToModule}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Main content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-6 pb-32">
            <ModuleRenderer
              currentModule={player.currentModule}
              moduleCompleted={moduleCompleted}
              videoRef={player.videoRef}
              videoProgress={player.videoProgress}
              onVideoTimeUpdate={player.handleVideoTimeUpdate}
              isYouTube={player.videoState.isYouTube}
              isVimeo={player.videoState.isVimeo}
              hasRealTracking={player.videoState.hasRealTracking}
              playerLoadError={player.playerLoadError}
              currentQuestionIndex={player.currentQuestionIndex}
              selectedAnswers={player.selectedAnswers}
              answeredQuestions={player.answeredQuestions}
              quizSubmitted={player.quizSubmitted}
              quizScore={player.quizScore}
              alreadyAttempted={player.alreadyAttempted}
              onAnswerSelect={player.handleAnswerSelect}
              onConfirmAnswer={player.handleConfirmAnswer}
              onNextQuestion={player.handleNextQuestion}
              onSubmitDesafio={player.handleSubmitDesafio}
              trailId={id as string}
              trailTitle={player.trail?.titulo || ''}
              userId={player.user?.uid || ''}
              onCompleteModule={player.completeModule}
            />
          </div>

          <TrailBottomBar
            currentModule={player.currentModule}
            moduleCompleted={moduleCompleted}
            quizSubmitted={player.quizSubmitted}
            saving={player.saving}
            videoCompleted={player.videoCompleted}
            hasRealTracking={player.videoState.hasRealTracking}
            playerLoadError={player.playerLoadError}
            activeModuleIndex={player.activeModuleIndex}
            totalModules={player.totalModules}
            isWorkbook={player.currentModule?.tipo === 'faca_voce_mesmo' && isWorkbookModule(player.currentModule?.conteudo?.instrucao)}
            onPrev={player.goPrev}
            onNext={player.goNext}
            onCompleteModule={player.completeModule}
            onUnlockMission={player.handleUnlockMission}
          />
        </div>
      </div>
    </div>
  );
}
