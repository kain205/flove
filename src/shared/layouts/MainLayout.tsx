import { ReactNode } from 'react';
import { Heart, Sparkles, Shuffle, MessageCircle, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';

interface MainLayoutProps {
  children: ReactNode;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

export type AppTab = 'ai-picks' | 'blind-date' | 'messages' | 'profile';

const tabs = [
  { id: 'ai-picks' as const, labelKey: 'navigation.aiPicks', icon: Sparkles },
  { id: 'blind-date' as const, labelKey: 'navigation.blindDate', icon: Shuffle },
  { id: 'messages' as const, labelKey: 'navigation.messages', icon: MessageCircle },
  { id: 'profile' as const, labelKey: 'navigation.profile', icon: User },
];

const MainLayout = ({ children, activeTab, onTabChange }: MainLayoutProps) => {
  const { t } = useTranslation('common');
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header - Enhanced glassmorphism */}
      <header className="flex items-center justify-between p-4 glass border-b border-border/30 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onTabChange('ai-picks')}
            className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-soft hover:shadow-glow transition-shadow duration-300 cursor-pointer"
            aria-label="Go to AI Picks"
          >
            <Heart className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
          </button>
          <span className="font-serif text-lg font-bold text-foreground">F-Love</span>
        </div>
        <LanguageSwitcher />
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 overflow-hidden bg-aurora">
        {children}
      </main>

      {/* Bottom Navigation - Enhanced design */}
      <nav className="flex items-center justify-around p-3 glass border-t border-border/30 safe-area-bottom">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`
                relative flex flex-col items-center gap-1.5 py-2 px-5 rounded-2xl transition-all duration-300 cursor-pointer
                ${isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              {/* Active indicator background */}
              {isActive && (
                <div className="absolute inset-0 bg-primary/10 rounded-2xl animate-scale-in" />
              )}
              
              <div className={`
                relative z-10 p-2.5 rounded-xl transition-all duration-300
                ${isActive 
                  ? 'bg-primary/15 shadow-soft' 
                  : 'hover:bg-muted/50'
                }
              `}>
                <Icon className={`
                  w-5 h-5 transition-all duration-300
                  ${isActive ? 'text-primary scale-110' : ''}
                `} />
              </div>
              <span className={`
                relative z-10 text-xs font-medium transition-colors duration-300
                ${isActive ? 'text-primary' : ''}
              `}>
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default MainLayout;
