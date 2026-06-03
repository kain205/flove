import { Suspense, lazy } from 'react';
import { Capacitor } from '@capacitor/core';
import { useLocation, useNavigate } from 'react-router-dom';
import LandingPage from './LandingPage';
import LoginPage from '@/features/auth/pages/LoginPage';
import MainLayout from '@/shared/layouts/MainLayout';
import { getActiveTabForPath, getPathForTab, type AppTab } from '@/app/routes';
import { useAuth } from '@/features/auth/useAuth';

const AiPicksPage = lazy(() => import('@/features/ai-picks/pages/AiPicksPage'));
const BlindDatePage = lazy(() => import('@/features/blind-date/pages/BlindDatePage'));
const MessagesPage = lazy(() => import('@/features/messages/pages/MessagesPage'));
const ProfilePage = lazy(() => import('@/features/profile/pages/ProfilePage'));

const PageLoading = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
  </div>
);

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, status, refreshProfile } = useAuth();
  const activeTab = getActiveTabForPath(location.pathname);

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    const isMobile = Capacitor.isNativePlatform();
    if (isMobile) {
      return <LoginPage onLoginSuccess={() => void refreshProfile()} />;
    }
    return <LandingPage onLoginSuccess={() => void refreshProfile()} />;
  }

  const handleTabChange = (tab: AppTab) => {
    navigate(getPathForTab(tab));
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'ai-picks':
        return (
          <AiPicksPage
            user={user}
            onNavigateToMessages={() => navigate(getPathForTab('messages'))}
            onNavigateToProfile={() => navigate(getPathForTab('profile'))}
          />
        );
      case 'blind-date':
        return <BlindDatePage />;
      case 'messages':
        return <MessagesPage />;
      case 'profile':
        return (
          <ProfilePage
            user={user}
            onUserUpdate={() => void refreshProfile()}
            onNavigateToAiPicks={() => navigate(getPathForTab('ai-picks'))}
          />
        );
      default:
        return null;
    }
  };

  return (
    <MainLayout activeTab={activeTab} onTabChange={handleTabChange}>
      <Suspense fallback={<PageLoading />}>
        {renderContent()}
      </Suspense>
    </MainLayout>
  );
};

export default Index;
