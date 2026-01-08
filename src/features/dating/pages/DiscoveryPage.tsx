import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SwipeCard from '../components/SwipeCard';
import MatchModal from '../components/MatchModal';
import { matchService } from '@/services/matchService';
import { Profile, Match } from '@/types';

interface DiscoveryPageProps {
  onNavigateToMessages: () => void;
}

const DiscoveryPage = ({ onNavigateToMessages }: DiscoveryPageProps) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<'left' | 'right' | null>(null);
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
    if (!currentProfile || isAnimating) return;

    setIsAnimating(true);
    setAnimationDirection(direction);

    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 400));

    if (direction === 'right') {
      const result = await matchService.swipeRight(currentProfile.id);
      if (result.isMatch && result.match) {
        setCurrentMatch(result.match);
        setMatchModalOpen(true);
      }
    } else {
      await matchService.swipeLeft(currentProfile.id);
    }

    setIsAnimating(false);
    setAnimationDirection(null);
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

  // No more profiles
  if (!isLoading && currentIndex >= profiles.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
          <RefreshCw className="w-12 h-12 text-muted-foreground" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-foreground mb-2">
          No More Profiles
        </h2>
        <p className="text-muted-foreground mb-6 max-w-xs">
          You've seen everyone nearby! Check back later for new students.
        </p>
        <Button
          onClick={handleRefresh}
          className="gradient-primary text-primary-foreground rounded-xl px-8 h-12"
        >
          <RefreshCw className="w-5 h-5 mr-2" />
          Refresh Profiles
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 text-center">
        <h1 className="font-serif text-2xl font-bold text-foreground">Discover</h1>
        <p className="text-sm text-muted-foreground">
          {profiles.length - currentIndex} profiles left
        </p>
      </div>

      {/* Cards Stack */}
      <div className="flex-1 relative px-4 pb-32">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : currentProfile ? (
          <div className="relative h-full flex items-start justify-center pt-4">
            {/* Background cards for stack effect */}
            {profiles[currentIndex + 2] && (
              <div className="absolute top-8 left-1/2 -translate-x-1/2 w-[calc(100%-4rem)] max-w-[calc(24rem-2rem)] h-[480px] rounded-3xl bg-card shadow-soft opacity-30 scale-90" />
            )}
            {profiles[currentIndex + 1] && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[calc(24rem-1rem)] h-[490px] rounded-3xl bg-card shadow-card opacity-50 scale-95" />
            )}
            
            {/* Current Card */}
            <SwipeCard
              profile={currentProfile}
              onSwipeLeft={() => handleSwipe('left')}
              onSwipeRight={() => handleSwipe('right')}
              isAnimating={isAnimating}
              animationDirection={animationDirection}
            />
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
