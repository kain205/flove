import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { chatService } from '@/services/chatService';
import { auth } from '@/lib/firebase';
import { getMockUser, isMockMode } from '@/services/mockService';
import { Message } from '@/types';

interface LocationState {
  participantName?: string;
  participantAvatar?: string;
}

const ChatRoomPage = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const currentUid = isMockMode() ? getMockUser().id : auth.currentUser?.uid ?? '';

  useEffect(() => {
    if (!conversationId) return;

    // Mark as read on open
    chatService.markAsRead(conversationId).catch(() => {});

    // Subscribe to real-time messages
    const unsubscribe = chatService.subscribeMessages(conversationId, (msgs) => {
      setMessages(msgs);
    });

    return unsubscribe;
  }, [conversationId]);

  // Auto-scroll to latest
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!conversationId || !input.trim() || isSending) return;
    setIsSending(true);
    try {
      const sent = await chatService.sendMessage(conversationId, input.trim());
      if (isMockMode()) {
        setMessages(prev => [...prev, sent]);
      }
      setInput('');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shadow-sm">
        <button
          onClick={() => navigate('/messages')}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {state.participantAvatar ? (
          <img
            src={state.participantAvatar}
            alt={state.participantName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
            {state.participantName?.[0]?.toUpperCase() ?? '?'}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">
            {state.participantName ?? 'Chat'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => {
          const isMe = msg.senderId === currentUid;
          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  isMe
                    ? 'gradient-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                }`}
              >
                <p>{msg.content}</p>
                <p className={`text-xs mt-1 ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                  {formatTime(msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp))}
                </p>
              </div>
            </div>
          );
        })}

        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full pt-20">
            <p className="text-muted-foreground text-sm">Hãy bắt đầu cuộc trò chuyện!</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-card">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập tin nhắn..."
            className="flex-1 h-12 rounded-2xl bg-muted/50 border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20"
            disabled={isSending}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="w-12 h-12 rounded-2xl gradient-primary text-primary-foreground p-0 shadow-soft hover:shadow-card transition-all duration-300"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatRoomPage;
