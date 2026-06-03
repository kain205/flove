import { Suspense, lazy, useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import LandingPage from './LandingPage';
import LoginPage from '@/features/auth/pages/LoginPage';
import MainLayout, { AppTab } from '@/shared/layouts/MainLayout';
import { User } from '@/types';
import { authService } from '@/services/authService';

const AiPicksPage = lazy(() => import('@/features/ai-picks/pages/AiPicksPage'));
const BlindDatePage = lazy(() => import('@/features/blind-date/pages/BlindDatePage'));
const MessagesPage = lazy(() => import('@/features/messages/pages/MessagesPage'));
const ProfilePage = lazy(() => import('@/features/profile/pages/ProfilePage'));

const TAB_PATHS: Record<AppTab, string> = {
  'ai-picks': '/ai-picks',
  'blind-date': '/blind-date',
  messages: '/messages',
  profile: '/profile',
};

function getActiveTab(pathname: string): AppTab {
  if (pathname.startsWith('/blind-date')) return 'blind-date';
  if (pathname.startsWith('/messages')) return 'messages';
  if (pathname.startsWith('/profile')) return 'profile';
  return 'ai-picks';
}

const PageLoading = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
  </div>
);

const Index = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const activeTab = getActiveTab(location.pathname);

  useEffect(() => {
    const unsubscribe = authService.onAuthChanged((u) => {
      setUser(u);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

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

  if (location.pathname === '/') {
    return <Navigate to={TAB_PATHS['ai-picks']} replace />;
  }

  const handleTabChange = (tab: AppTab) => {
    navigate(TAB_PATHS[tab]);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'ai-picks':
        return (
          <AiPicksPage
            user={user}
            onNavigateToMessages={() => navigate(TAB_PATHS.messages)}
            onNavigateToProfile={() => navigate(TAB_PATHS.profile)}
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
            onUserUpdate={setUser}
            onNavigateToAiPicks={() => navigate(TAB_PATHS['ai-picks'])}
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
