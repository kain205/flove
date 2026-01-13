import { useState } from 'react';
import { Shuffle, Sparkles, Eye, MessageSquare, Shield, Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import RadarAnimation from '../components/RadarAnimation';
import AnonymousChat from '../components/AnonymousChat';
import { chatService } from '@/services/chatService';
import { BlindDateSession } from '@/types';

const BlindDatePage = () => {
  const { t } = useTranslation('blindDate');
  const [isSearching, setIsSearching] = useState(false);
  const [session, setSession] = useState<BlindDateSession | null>(null);
  const [inChat, setInChat] = useState(false);

  const handleFindPartner = async () => {
    setIsSearching(true);

    try {
      const newSession = await chatService.findBlindDatePartner();
      setSession(newSession);
      setInChat(true);
    } catch (error) {
      console.error('Failed to find partner:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleBackFromChat = () => {
    setInChat(false);
    setSession(null);
    chatService.clearBlindDateSession();
  };

  const handleRevealAccepted = () => {
    // Navigate to messages or show revealed profile
    setInChat(false);
    setSession(null);
  };

  // Show chat if in session
  if (inChat && session) {
    return (
      <AnonymousChat
        session={session}
        onBack={handleBackFromChat}
        onRevealAccepted={handleRevealAccepted}
      />
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-aurora pointer-events-none opacity-50" />
      
      {/* Floating elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Heart className="absolute top-20 left-[15%] w-8 h-8 text-accent/10 floating-heart" style={{ animationDelay: '0s' }} />
        <Sparkles className="absolute top-32 right-[20%] w-6 h-6 text-primary/15 floating-heart" style={{ animationDelay: '0.5s' }} />
        <Heart className="absolute bottom-40 right-[25%] w-10 h-10 text-rose/10 floating-heart" style={{ animationDelay: '1s' }} />
      </div>
      
      {/* Header */}
      <div className="text-center mb-10 relative z-10 animate-slide-up">
        <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent/10 border border-accent/20 text-accent mb-5 shadow-soft">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-semibold">{t('blindDate.badge')}</span>
        </div>
        <h1 className="font-serif text-4xl font-bold text-foreground mb-3">
          {t('blindDate.title')}
        </h1>
        <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed">
          {t('blindDate.subtitle')}
        </p>
      </div>

      {/* Radar Animation */}
      <div className="mb-10 relative z-10 animate-slide-up-delay-1">
        <RadarAnimation isSearching={isSearching} />
      </div>

      {/* Status Text */}
      {isSearching && (
        <div className="flex items-center gap-3 text-muted-foreground mb-8 animate-fade-in">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <p className="font-medium">{t('blindDate.searching')}</p>
        </div>
      )}

      {/* Find Button */}
      {!isSearching && (
        <Button
          onClick={handleFindPartner}
          size="lg"
          className="gradient-primary text-primary-foreground rounded-2xl px-10 h-16 text-lg font-semibold shadow-card hover:shadow-float transition-all duration-300 btn-shine cursor-pointer animate-slide-up-delay-2"
        >
          <Shuffle className="w-6 h-6 mr-3" />
          {t('blindDate.findPartner')}
        </Button>
      )}

      {/* Info Cards - Using proper icons instead of emojis */}
      <div className="grid grid-cols-2 gap-5 mt-14 w-full max-w-md relative z-10 animate-slide-up-delay-3">
        <div className="p-5 rounded-2xl glass-card shadow-soft text-center card-hover cursor-default group">
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-accent/20 transition-colors duration-300">
            <Eye className="w-6 h-6 text-accent" />
          </div>
          <h4 className="font-semibold text-foreground text-sm mb-1">Ẩn danh</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">{t('blindDate.infoCards.anonymous')}</p>
        </div>
        <div className="p-5 rounded-2xl glass-card shadow-soft text-center card-hover cursor-default group">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors duration-300">
            <MessageSquare className="w-6 h-6 text-primary" />
          </div>
          <h4 className="font-semibold text-foreground text-sm mb-1">Trò chuyện tự do</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">Reveal khi cả hai sẵn sàng</p>
        </div>
      </div>
      
      {/* Safety note */}
      <div className="flex items-center gap-2 mt-8 text-muted-foreground/80 animate-slide-up-delay-3">
        <Shield className="w-4 h-4 text-primary" />
        <span className="text-xs">Chat an toàn & bảo mật</span>
      </div>
    </div>
  );
};

export default BlindDatePage;
