import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import LandingPage from './LandingPage';
import LoginPage from '@/features/auth/pages/LoginPage';
import BioPromptPage from '@/features/auth/pages/BioPromptPage';
import AiPicksPage from '@/features/ai-picks/pages/AiPicksPage';
import BlindDatePage from '@/features/blind-date/pages/BlindDatePage';
import MessagesPage from '@/features/messages/pages/MessagesPage';
import MainLayout from '@/shared/layouts/MainLayout';
import ProfilePage from '@/features/profile/pages/ProfilePage';
import { User } from '@/types';
import { authService } from '@/services/authService';

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ai-picks' | 'blind-date' | 'messages' | 'profile'>('ai-picks');

  const [showBioPrompt, setShowBioPrompt] = useState(false);

  useEffect(() => {
    // Load cached user instantly — no spinner on return visits
    const cached = localStorage.getItem('flove-user');
    if (cached) {
      const u = JSON.parse(cached) as User;
      setUser(u);
      setIsLoading(false);
    }

    // Then sync from Firebase in background
    const unsubscribe = authService.onAuthChanged((u) => {
      if (u) {
        localStorage.setItem('flove-user', JSON.stringify(u));
        setUser(u);
      } else {
        localStorage.removeItem('flove-user');
        setUser(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  // Show bio prompt whenever user changes and bio is empty
  useEffect(() => {
    if (user && user.bio === '') setShowBioPrompt(true);
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    const isMobile = Capacitor.isNativePlatform();
    if (isMobile) {
      return <LoginPage onLoginSuccess={setUser} />;
    }
    return <LandingPage onLoginSuccess={setUser} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'ai-picks':
        return <AiPicksPage onNavigateToMessages={() => setActiveTab('messages')} />;
      case 'blind-date':
        return <BlindDatePage />;
      case 'messages':
        return <MessagesPage />;
      case 'profile':
        return <ProfilePage user={user} onUserUpdate={setUser} />;
      default:
        return null;
    }
  };

  return (
    <>
      <MainLayout activeTab={activeTab} onTabChange={setActiveTab}>
        {renderContent()}
      </MainLayout>

      {showBioPrompt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md animate-slide-up">
            <BioPromptPage
              user={user}
              onComplete={(bio) => {
                setUser({ ...user, bio });
                setShowBioPrompt(false);
              }}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Index;
