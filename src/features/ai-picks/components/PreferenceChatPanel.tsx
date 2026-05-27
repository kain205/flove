import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Sparkles, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { preferenceChatService } from '@/services/preferenceChatService';
import { curatedMatchService } from '@/services/curatedMatchService';
import { PreferenceChatMessage, PreferenceProfile } from '@/types';

const PreferenceChatPanel = () => {
  const { t } = useTranslation('aiPicks');
  const [messages, setMessages] = useState<PreferenceChatMessage[]>([]);
  const [preference, setPreference] = useState<PreferenceProfile | null>(null);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    curatedMatchService.getPreferenceProfile()
      .then(setPreference)
      .catch(() => setPreference(null));

    const unsubscribe = preferenceChatService.subscribeMessages(setMessages);
    return unsubscribe;
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    setIsSending(true);
    try {
      await preferenceChatService.sendMessage(input);
      setInput('');
      const updated = await curatedMatchService.getPreferenceProfile();
      setPreference(updated);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <aside className="bg-card border border-border/60 rounded-2xl shadow-soft overflow-hidden">
      <div className="p-4 border-b border-border/60">
        <div className="flex items-center gap-2 text-primary font-semibold">
          <Sparkles className="w-4 h-4" />
          {t('chat.title')}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{t('chat.subtitle')}</p>
      </div>

      {preference && (
        <div className="px-4 py-3 bg-muted/40 border-b border-border/60">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t('chat.preferenceSummary')}
          </p>
          <p className="text-sm text-foreground mt-1 line-clamp-3">{preference.summary}</p>
        </div>
      )}

      <div className="h-72 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-center px-6">
            <p className="text-sm text-muted-foreground">{t('chat.empty')}</p>
          </div>
        )}

        {messages.map(message => {
          const isUser = message.sender === 'user';
          return (
            <div
              key={message.id}
              className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  isUser
                    ? 'gradient-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted text-foreground rounded-bl-md'
                }`}
              >
                {message.content}
              </div>
              {isUser && (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-border/60">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSend();
              }
            }}
            placeholder={t('chat.placeholder')}
            disabled={isSending}
            className="h-11 rounded-xl"
          />
          <Button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="h-11 w-11 rounded-xl p-0 gradient-primary text-primary-foreground"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
};

export default PreferenceChatPanel;
