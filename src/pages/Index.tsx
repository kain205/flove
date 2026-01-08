import { useState, useEffect } from 'react';
import LoginPage from '@/features/auth/pages/LoginPage';
import DiscoveryPage from '@/features/dating/pages/DiscoveryPage';
import BlindDatePage from '@/features/blind-date/pages/BlindDatePage';
import MessagesPage from '@/features/messages/pages/MessagesPage';
import MainLayout from '@/shared/layouts/MainLayout';
import { User } from '@/types';
import { authService } from '@/services/authService';

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'discovery' | 'blind-date' | 'messages' | 'profile'>('discovery');

  useEffect(() => {
    const checkAuth = async () => {
      const savedUser = await authService.getCurrentUser();
      if (savedUser) setUser(savedUser);
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={setUser} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'discovery':
        return <DiscoveryPage onNavigateToMessages={() => setActiveTab('messages')} />;
      case 'blind-date':
        return <BlindDatePage />;
      case 'messages':
        return <MessagesPage />;
      case 'profile':
        return (
          <div className="p-6 text-center">
            <h2 className="font-serif text-2xl font-bold mb-4">Profile</h2>
            <p className="text-muted-foreground mb-4">Welcome, {user.name}!</p>
            <button
              onClick={() => { authService.clearUser(); setUser(null); }}
              className="text-destructive underline"
            >
              Logout
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <MainLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </MainLayout>
  );
};

export default Index;
