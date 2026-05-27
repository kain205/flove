import { useState, useRef, useEffect } from 'react';
import { Send, Eye, ArrowLeft, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BlindDateSession, Message } from '@/types';
import { chatService } from '@/services/chatService';

interface AnonymousChatProps {
  session: BlindDateSession;
  onBack: () => void;
  onRevealAccepted: () => void;
}

const AnonymousChat = ({ session, onBack, onRevealAccepted }: AnonymousChatProps) => {
  const { t } = useTranslation('blindDate');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      senderId: session.partnerId,
      content: t('anonymousChat.initialMessage'),
      timestamp: new Date(),
      isRead: true,
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealResult, setRevealResult] = useState<'pending' | 'accepted' | 'rejected' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      senderId: 'me',
      content: inputValue.trim(),
      timestamp: new Date(),
      isRead: false,
    };

    setMessages(prev => [...prev, newMessage]);
    setInputValue('');

    // Simulate partner response
    setTimeout(() => {
      const responses = [
        "That's interesting! Tell me more 😊",
        "Haha, I totally agree!",
        "What do you study at FPT?",
        "This blind date thing is so exciting!",
        "I wonder what you look like 🤔",
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        senderId: session.partnerId,
        content: randomResponse,
        timestamp: new Date(),
        isRead: true,
      }]);
    }, 1500);
  };

  const handleRevealRequest = async () => {
    setIsRevealing(true);
    setRevealResult('pending');

    try {
      const result = await chatService.requestReveal(session.id);
      setRevealResult(result.accepted ? 'accepted' : 'rejected');
      
      if (result.accepted) {
        setTimeout(() => {
          onRevealAccepted();
        }, 2000);
      }
    } catch {
      setRevealResult('rejected');
    } finally {
      setIsRevealing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-border bg-card">
        <button
          onClick={onBack}
          className="p-2 rounded-full hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <User className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">{session.partnerMaskedName}</h2>
            <p className="text-xs text-muted-foreground">{t('anonymousChat.anonymousMatch')}</p>
          </div>
        </div>

        {!session.isRevealed && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleRevealRequest}
            disabled={isRevealing || revealResult !== null}
            className="rounded-xl"
          >
            <Eye className="w-4 h-4 mr-1" />
            {revealResult === 'pending' ? t('anonymousChat.requesting') : 
             revealResult === 'accepted' ? t('anonymousChat.accepted') :
             revealResult === 'rejected' ? t('anonymousChat.declined') : t('anonymousChat.revealRequest')}
          </Button>
        )}
      </div>

      {/* Reveal Result Toast */}
      {revealResult && (
        <div className={`
          mx-4 mt-4 p-3 rounded-xl text-center text-sm font-medium
          ${revealResult === 'accepted' ? 'bg-green-100 text-green-800' : ''}
          ${revealResult === 'rejected' ? 'bg-destructive/10 text-destructive' : ''}
          ${revealResult === 'pending' ? 'bg-muted text-muted-foreground' : ''}
        `}>
          {revealResult === 'accepted' && t('anonymousChat.revealToasts.accepted')}
          {revealResult === 'rejected' && t('anonymousChat.revealToasts.rejected')}
          {revealResult === 'pending' && t('anonymousChat.revealToasts.pending')}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isMine = message.senderId === 'me';
          
          return (
            <div
              key={message.id}
              className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`
                  max-w-[75%] px-4 py-3 rounded-2xl
                  ${isMine 
                    ? 'gradient-primary text-primary-foreground rounded-br-md' 
                    : 'bg-muted text-foreground rounded-bl-md'
                  }
                `}
              >
                <p className="text-sm">{message.content}</p>
                <p className={`text-xs mt-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card">
        <div className="flex gap-3">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={t('anonymousChat.messagePlaceholder')}
            className="flex-1 h-12 rounded-xl"
          />
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="h-12 w-12 rounded-xl gradient-primary"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AnonymousChat;
