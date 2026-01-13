import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import ConversationList from '../components/ConversationList';
import { chatService } from '@/services/chatService';
import { Conversation } from '@/types';

const MessagesPage = () => {
  const { t } = useTranslation('messages');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadConversations = async () => {
      try {
        const data = await chatService.getConversations();
        setConversations(data);
      } catch (error) {
        console.error('Failed to load conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConversations();
  }, []);

  const filteredConversations = conversations.filter(conv =>
    conv.participant.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectConversation = (conversation: Conversation) => {
    // TODO: Navigate to chat room
    console.log('Selected conversation:', conversation.id);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <h1 className="font-serif text-2xl font-bold text-foreground mb-4">{t('messages.title')}</h1>
        
        {/* Search */}
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
        <button className="flex-1 py-3 text-sm font-medium text-primary border-b-2 border-primary">
          {t('messages.tabs.all')}
        </button>
        <button className="flex-1 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          {t('messages.tabs.matches')}
        </button>
        <button className="flex-1 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          {t('messages.tabs.anonymous')}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <ConversationList
            conversations={filteredConversations}
            onSelectConversation={handleSelectConversation}
          />
        )}
      </div>
    </div>
  );
};

export default MessagesPage;
