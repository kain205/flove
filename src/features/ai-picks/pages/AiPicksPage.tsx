import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, MessageCircle, RefreshCw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import CuratedMatchCard from '../components/CuratedMatchCard';
import PreferenceChatPanel from '../components/PreferenceChatPanel';
import { curatedMatchService } from '@/services/curatedMatchService';
import { CuratedMatch, DailyMatchBatch, MatchFeedbackDecision } from '@/types';

interface AiPicksPageProps {
  onNavigateToMessages: () => void;
}

const AiPicksPage = ({ onNavigateToMessages }: AiPicksPageProps) => {
  const { t } = useTranslation('aiPicks');
  const [batch, setBatch] = useState<DailyMatchBatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [workingMatchId, setWorkingMatchId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showPreferenceChat, setShowPreferenceChat] = useState(false);

  const loadMatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const today = await curatedMatchService.getTodayMatches();
      setBatch(today);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  const pendingCount = useMemo(
    () => batch?.matches.filter(match => match.status === 'pending').length ?? 0,
    [batch]
  );

  const handleAccept = async (matchId: string, tags: string[], note?: string) => {
    setWorkingMatchId(matchId);
    setNotice(null);
    try {
      const result = await curatedMatchService.acceptMatch(matchId, tags, note);
      setNotice(result.isMutual ? t('notice.mutual') : t('notice.waiting'));
      await loadMatches();
    } finally {
      setWorkingMatchId(null);
    }
  };

  const handleFeedback = async (
    matchId: string,
    decision: Exclude<MatchFeedbackDecision, 'accepted'>,
    tags: string[],
    note?: string
  ) => {
    setWorkingMatchId(matchId);
    setNotice(null);
    try {
      await curatedMatchService.submitFeedback(matchId, decision, tags, note);
      setNotice(t(`notice.${decision}`));
      await loadMatches();
    } finally {
      setWorkingMatchId(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border/60">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
                <Sparkles className="w-4 h-4" />
                {t('header.badge')}
              </div>
              <h1 className="font-serif text-2xl font-bold text-foreground">
                {t('header.title')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {batch
                  ? t('header.subtitleWithDate', { date: batch.date, count: batch.matches.length })
                  : t('header.subtitle')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowPreferenceChat(current => !current)}
                className="rounded-xl"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                {t('header.refine')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={loadMatches}
                disabled={isLoading}
                className="rounded-xl"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {notice && (
          <div className="rounded-2xl border border-primary/20 bg-primary/10 text-primary px-4 py-3 text-sm font-medium">
            {notice}
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr_22rem] gap-5 items-start">
          <section className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="w-4 h-4 text-primary" />
                {pendingCount > 0
                  ? t('summary.pending', { count: pendingCount })
                  : t('summary.done')}
              </div>
              {pendingCount === 0 && batch && batch.matches.length > 0 && (
                <Button
                  type="button"
                  onClick={onNavigateToMessages}
                  variant="outline"
                  className="rounded-xl"
                >
                  {t('summary.openMessages')}
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="h-96 flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">{t('loading')}</p>
              </div>
            ) : batch && batch.matches.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-5">
                {batch.matches.map((match: CuratedMatch) => (
                  <CuratedMatchCard
                    key={match.id}
                    match={match}
                    isWorking={workingMatchId === match.id}
                    onAccept={handleAccept}
                    onFeedback={handleFeedback}
                  />
                ))}
              </div>
            ) : (
              <div className="h-96 rounded-2xl border border-border/60 bg-card flex flex-col items-center justify-center text-center px-6">
                <Sparkles className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <h2 className="font-serif text-2xl font-bold text-foreground">
                  {t('empty.title')}
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mt-2">
                  {t('empty.description')}
                </p>
                <Button
                  type="button"
                  onClick={() => setShowPreferenceChat(true)}
                  className="mt-5 rounded-xl gradient-primary text-primary-foreground"
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  {t('empty.refine')}
                </Button>
              </div>
            )}
          </section>

          <div className={showPreferenceChat ? 'block' : 'hidden lg:block'}>
            <PreferenceChatPanel />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AiPicksPage;
