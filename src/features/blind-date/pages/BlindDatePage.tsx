import { useState } from 'react';
import { Shuffle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RadarAnimation from '../components/RadarAnimation';
import AnonymousChat from '../components/AnonymousChat';
import { chatService } from '@/services/chatService';
import { BlindDateSession } from '@/types';

const BlindDatePage = () => {
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
    <div className="h-full flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent mb-4">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium">Mystery Awaits</span>
        </div>
        <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
          Blind Date
        </h1>
        <p className="text-muted-foreground max-w-xs mx-auto">
          Connect anonymously with another FPT student. Chat first, reveal later!
        </p>
      </div>

      {/* Radar Animation */}
      <div className="mb-8">
        <RadarAnimation isSearching={isSearching} />
      </div>

      {/* Status Text */}
      {isSearching && (
        <p className="text-muted-foreground mb-6 animate-pulse">
          Finding your anonymous match...
        </p>
      )}

      {/* Find Button */}
      {!isSearching && (
        <Button
          onClick={handleFindPartner}
          size="lg"
          className="gradient-primary text-primary-foreground rounded-2xl px-8 h-14 text-base font-semibold shadow-card hover:shadow-float transition-all"
        >
          <Shuffle className="w-5 h-5 mr-2" />
          Find Anonymous Partner
        </Button>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-4 mt-12 w-full max-w-sm">
        <div className="p-4 rounded-2xl bg-card shadow-soft text-center">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
            <span className="text-xl">🎭</span>
          </div>
          <p className="text-xs text-muted-foreground">Stay anonymous until you're ready</p>
        </div>
        <div className="p-4 rounded-2xl bg-card shadow-soft text-center">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-2">
            <span className="text-xl">💬</span>
          </div>
          <p className="text-xs text-muted-foreground">Chat freely, reveal when comfortable</p>
        </div>
      </div>
    </div>
  );
};

export default BlindDatePage;
