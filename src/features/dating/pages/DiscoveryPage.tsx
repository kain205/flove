import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Sparkles, Heart } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import SwipeCard from '../components/SwipeCard';
import MatchModal from '../components/MatchModal';
import { matchService } from '@/services/matchService';
import { Profile, Match } from '@/types';

interface DiscoveryPageProps {
  onNavigateToMessages: () => void;
}

const DiscoveryPage = ({ onNavigateToMessages }: DiscoveryPageProps) => {
  const { t } = useTranslation('dating');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);

  const loadProfiles = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await matchService.getProfiles();
      setProfiles(data);
      setCurrentIndex(0);
    } catch (error) {
      console.error('Failed to load profiles:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const currentProfile = profiles[currentIndex];

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (!currentProfile) return;

    if (direction === 'right') {
      const result = await matchService.swipeRight(currentProfile.id);
      if (result.isMatch && result.match) {
        setCurrentMatch(result.match);
        setMatchModalOpen(true);
      }
    } else {
      await matchService.swipeLeft(currentProfile.id);
    }

    setCurrentIndex(prev => prev + 1);
  };

  const handleRefresh = () => {
    matchService.resetProfiles();
    loadProfiles();
  };

  const handleSendMessage = () => {
    setMatchModalOpen(false);
    onNavigateToMessages();
  };

  // No more profiles - Enhanced empty state
  if (!isLoading && currentIndex >= profiles.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-aurora opacity-50 pointer-events-none" />
        
        <div className="relative z-10 animate-slide-up">
          <div className="w-28 h-28 rounded-3xl bg-muted/50 glass-card flex items-center justify-center mb-8 mx-auto shadow-card">
            <Heart className="w-14 h-14 text-muted-foreground/50" />
          </div>
          <h2 className="font-serif text-3xl font-bold text-foreground mb-3">
            {t('discovery.noMoreProfiles.title')}
          </h2>
          <p className="text-muted-foreground mb-8 max-w-sm leading-relaxed">
            {t('discovery.noMoreProfiles.description')}
          </p>
          <Button
            onClick={handleRefresh}
            className="gradient-primary text-primary-foreground rounded-2xl px-10 h-14 text-base font-semibold shadow-card hover:shadow-float transition-all duration-300 btn-shine cursor-pointer"
          >
            <RefreshCw className="w-5 h-5 mr-3" />
            {t('discovery.noMoreProfiles.refreshButton')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative">
      {/* Header - Enhanced */}
      <div className="p-5 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/10 mb-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-primary">Discovery Mode</span>
        </div>
        <h1 className="font-serif text-2xl font-bold text-foreground">{t('discovery.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('discovery.profilesLeft', { count: profiles.length - currentIndex })}
        </p>
      </div>

      {/* Cards Stack */}
      <div className="flex-1 relative px-4 pb-36">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="w-14 h-14 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground animate-pulse">Đang tải...</p>
          </div>
        ) : currentProfile ? (
          <div className="relative h-full flex items-start justify-center pt-4">
            {/* Background cards for stack effect - Enhanced */}
            {profiles[currentIndex + 2] && (
              <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[calc(100%-5rem)] max-w-[calc(24rem-2.5rem)] h-[500px] rounded-3xl bg-card/50 shadow-soft opacity-30 scale-[0.88] blur-[1px]" />
            )}
            {profiles[currentIndex + 1] && (
              <div className="absolute top-7 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-[calc(24rem-1.5rem)] h-[510px] rounded-3xl bg-card/70 shadow-card opacity-50 scale-95" />
            )}
            
            {/* Current Card */}
            <AnimatePresence mode="popLayout">
              {currentProfile && (
                <SwipeCard
                  key={currentProfile.id}
                  profile={currentProfile}
                  onSwipeLeft={() => handleSwipe('left')}
                  onSwipeRight={() => handleSwipe('right')}
                />
              )}
            </AnimatePresence>
          </div>
        ) : null}
      </div>

      {/* Match Modal */}
      <MatchModal
        isOpen={matchModalOpen}
        onClose={() => setMatchModalOpen(false)}
        match={currentMatch}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
};

export default DiscoveryPage;
