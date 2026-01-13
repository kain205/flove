import { Heart, Sparkles, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Match } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  onSendMessage: () => void;
}

const MatchModal = ({ isOpen, onClose, match, onSendMessage }: MatchModalProps) => {
  const { t } = useTranslation('dating');
  if (!match) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-3xl border-none bg-gradient-to-b from-primary/10 to-accent/10 p-0 overflow-hidden">
        <div className="relative">
          {/* Background Effect */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-accent/20 blur-2xl" />
          </div>

          {/* Content */}
          <div className="relative p-8 text-center">
            <DialogHeader>
              <DialogTitle className="sr-only">{t('matchModal.title')}</DialogTitle>
            </DialogHeader>

            {/* Hearts Animation */}
            <div className="flex justify-center mb-4">
              <div className="relative">
                <Heart className="w-16 h-16 text-primary fill-primary floating-heart" />
                <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-accent" />
              </div>
            </div>

            {/* Title */}
            <h2 className="font-serif text-3xl font-bold text-foreground mb-2">
              {t('matchModal.title')}
            </h2>
            <p className="text-muted-foreground mb-6">
              {t('matchModal.description', { name: match.matchedUser.name })}
            </p>

            {/* Profile Picture */}
            <div className="relative w-32 h-32 mx-auto mb-6">
              <img
                src={match.matchedUser.avatar}
                alt={match.matchedUser.name}
                className="w-full h-full rounded-full object-cover ring-4 ring-primary/30 shadow-float"
              />
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gradient-primary shadow-card">
                <Heart className="w-4 h-4 text-primary-foreground fill-primary-foreground" />
              </div>
            </div>

            {/* User Info */}
            <h3 className="font-semibold text-xl text-foreground">
              {match.matchedUser.name}, {match.matchedUser.age}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {match.matchedUser.major} • FPT {match.matchedUser.campus}
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 h-12 rounded-xl border-2"
              >
                {t('matchModal.keepSwiping')}
              </Button>
              <Button
                onClick={onSendMessage}
                className="flex-1 h-12 rounded-xl gradient-primary text-primary-foreground"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                {t('matchModal.sendMessage')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MatchModal;
