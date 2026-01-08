import { ReactNode } from 'react';
import { Heart, Compass, Shuffle, MessageCircle, User } from 'lucide-react';

interface MainLayoutProps {
  children: ReactNode;
  activeTab: 'discovery' | 'blind-date' | 'messages' | 'profile';
  onTabChange: (tab: 'discovery' | 'blind-date' | 'messages' | 'profile') => void;
}

const tabs = [
  { id: 'discovery' as const, label: 'Discover', icon: Compass },
  { id: 'blind-date' as const, label: 'Blind Date', icon: Shuffle },
  { id: 'messages' as const, label: 'Messages', icon: MessageCircle },
  { id: 'profile' as const, label: 'Profile', icon: User },
];

const MainLayout = ({ children, activeTab, onTabChange }: MainLayoutProps) => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-soft">
            <Heart className="w-4 h-4 text-primary-foreground fill-primary-foreground" />
          </div>
          <span className="font-serif text-lg font-bold text-foreground">F-Connect</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="flex items-center justify-around p-2 bg-card border-t border-border safe-area-bottom">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all
                ${isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              <div className={`
                p-2 rounded-xl transition-all
                ${isActive ? 'bg-primary/10' : ''}
              `}>
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
              </div>
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default MainLayout;
