import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import ConversationList from '../components/ConversationList';
import { chatService } from '@/services/chatService';
import { Conversation } from '@/types';

type Tab = 'all' | 'matches' | 'anonymous';

const MessagesPage = () => {
  const { t } = useTranslation('messages');
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('all');

  useEffect(() => {
    // Use real-time subscription
    const unsubscribe = chatService.subscribeConversations((data) => {
      setConversations(data);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const filtered = conversations.filter(conv => {
    const matchesSearch = conv.participant.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeTab === 'matches') return !conv.isAnonymous;
    if (activeTab === 'anonymous') return conv.isAnonymous;
    return true;
  });

  const handleSelectConversation = (conversation: Conversation) => {
    navigate(`/chat/${conversation.id}`, {
      state: {
        participantName: conversation.participant.name,
        participantAvatar: conversation.participant.avatar,
      },
    });
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: t('messages.tabs.all') },
    { key: 'matches', label: t('messages.tabs.matches') },
    { key: 'anonymous', label: t('messages.tabs.anonymous') },
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <h1 className="font-serif text-2xl font-bold text-foreground mb-4">{t('messages.title')}</h1>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder={t('messages.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-muted border-transparent"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <ConversationList
            conversations={filtered}
            onSelectConversation={handleSelectConversation}
          />
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
