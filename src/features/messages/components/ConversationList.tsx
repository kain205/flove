import { User } from 'lucide-react';
import { Conversation } from '@/types';

interface ConversationListProps {
  conversations: Conversation[];
  onSelectConversation: (conversation: Conversation) => void;
}

const ConversationList = ({ conversations, onSelectConversation }: ConversationListProps) => {
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-6">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <span className="text-3xl">💬</span>
        </div>
        <h3 className="font-semibold text-foreground mb-1">No Messages Yet</h3>
        <p className="text-sm text-muted-foreground">
          Review your AI Picks to open a chat after both people accept.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {conversations.map((conversation) => (
        <button
          key={conversation.id}
          onClick={() => onSelectConversation(conversation)}
          className="w-full flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors text-left"
        >
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {conversation.isAnonymous ? (
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <User className="w-7 h-7 text-muted-foreground" />
              </div>
            ) : (
              <img
                src={conversation.participant.avatar}
                alt={conversation.participant.name}
                className="w-14 h-14 rounded-full object-cover"
              />
            )}
            
            {/* Anonymous Badge */}
            {conversation.isAnonymous && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                <span className="text-xs">🎭</span>
              </div>
            )}

            {/* Unread Count */}
            {conversation.unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <span className="text-xs text-primary-foreground font-medium">
                  {conversation.unreadCount}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className={`font-semibold truncate ${conversation.unreadCount > 0 ? 'text-foreground' : 'text-foreground/80'}`}>
                {conversation.participant.name}
              </h3>
              <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                {formatTime(conversation.updatedAt)}
              </span>
            </div>
            
            {conversation.lastMessage && (
              <p className={`text-sm truncate ${conversation.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {conversation.lastMessage.content}
              </p>
            )}

            {/* Tags */}
            <div className="flex items-center gap-2 mt-1.5">
              {conversation.isAnonymous && (
                <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-medium">
                  Anonymous
                </span>
              )}
              {!conversation.isAnonymous && conversation.participant.major && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                  {conversation.participant.major}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default ConversationList;
