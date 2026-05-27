import { useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Flag,
  GraduationCap,
  Heart,
  MapPin,
  Sparkles,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CuratedMatch, MatchFeedbackDecision } from '@/types';

interface CuratedMatchCardProps {
  match: CuratedMatch;
  isWorking: boolean;
  onAccept: (matchId: string, tags: string[], note?: string) => void;
  onFeedback: (
    matchId: string,
    decision: Exclude<MatchFeedbackDecision, 'accepted'>,
    tags: string[],
    note?: string
  ) => void;
}

const TAG_KEYS = ['vibe', 'campus', 'interests', 'type', 'pace'] as const;

const statusClasses: Record<CuratedMatch['status'], string> = {
  pending: 'bg-primary/10 text-primary border-primary/20',
  accepted: 'bg-amber-100 text-amber-800 border-amber-200',
  declined: 'bg-muted text-muted-foreground border-border',
  skipped: 'bg-muted text-muted-foreground border-border',
  reported: 'bg-destructive/10 text-destructive border-destructive/20',
  matched: 'bg-green-100 text-green-800 border-green-200',
};

const CuratedMatchCard = ({
  match,
  isWorking,
  onAccept,
  onFeedback,
}: CuratedMatchCardProps) => {
  const { t } = useTranslation('aiPicks');
  const [selectedTags, setSelectedTags] = useState<string[]>(match.feedbackTags ?? []);
  const [note, setNote] = useState(match.feedbackNote ?? '');
  const isResolved = match.status !== 'pending';

  const tagOptions = useMemo(
    () => TAG_KEYS.map(key => ({
      key,
      label: t(`tags.${key}`),
    })),
    [t]
  );

  const toggleTag = (tag: string) => {
    setSelectedTags(current =>
      current.includes(tag)
        ? current.filter(item => item !== tag)
        : [...current, tag]
    );
  };

  return (
    <article className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-soft">
      <div className="relative h-72 bg-muted">
        {match.candidate.avatar ? (
          <img
            src={match.candidate.avatar}
            alt={match.candidate.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full gradient-primary flex items-center justify-center text-primary-foreground text-5xl font-serif">
            {match.candidate.name[0]?.toUpperCase() ?? '?'}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/75 via-black/20 to-transparent">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-serif text-3xl font-bold text-white truncate">
                {match.candidate.name}, {match.candidate.age}
              </h2>
              <div className="flex flex-wrap gap-2 mt-2 text-white/90 text-sm">
                <span className="inline-flex items-center gap-1">
                  <GraduationCap className="w-4 h-4" />
                  {match.candidate.major}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  FPT {match.candidate.campus}
                </span>
              </div>
            </div>
            <Badge className="bg-white/95 text-foreground hover:bg-white">
              {match.compatibilityScore}%
            </Badge>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline" className={statusClasses[match.status]}>
            {t(`status.${match.status}`)}
          </Badge>
          <span className="text-sm font-medium text-primary">{match.compatibilityLabel}</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
            {t('card.reasonTitle')}
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {match.aiReason}
          </p>
        </div>

        {match.candidate.bio && (
          <p className="text-sm leading-relaxed text-foreground/80">
            {match.candidate.bio}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {match.candidate.interests.slice(0, 6).map(interest => (
            <span
              key={interest}
              className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
            >
              {interest}
            </span>
          ))}
        </div>

        <div className="space-y-3 pt-1">
          <p className="text-sm font-semibold text-foreground">{t('card.feedbackPrompt')}</p>
          <div className="flex flex-wrap gap-2">
            {tagOptions.map(tag => {
              const active = selectedTags.includes(tag.label);
              return (
                <button
                  key={tag.key}
                  type="button"
                  onClick={() => toggleTag(tag.label)}
                  disabled={isResolved || isWorking}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
          </div>
          <Textarea
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder={t('card.notePlaceholder')}
            disabled={isResolved || isWorking}
            className="min-h-20 rounded-xl resize-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isResolved || isWorking}
            onClick={() => onFeedback(match.id, 'skipped', selectedTags, note)}
            className="rounded-xl"
          >
            <Clock className="w-4 h-4 mr-1" />
            {t('card.skip')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isResolved || isWorking || selectedTags.length === 0}
            onClick={() => onFeedback(match.id, 'declined', selectedTags, note)}
            className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <X className="w-4 h-4 mr-1" />
            {t('card.decline')}
          </Button>
          <Button
            type="button"
            disabled={isResolved || isWorking}
            onClick={() => onAccept(match.id, selectedTags, note)}
            className="rounded-xl gradient-primary text-primary-foreground"
          >
            {match.status === 'matched' ? (
              <Check className="w-4 h-4 mr-1" />
            ) : (
              <Heart className="w-4 h-4 mr-1" />
            )}
            {t('card.accept')}
          </Button>
        </div>

        {!isResolved && (
          <button
            type="button"
            disabled={isWorking}
            onClick={() => onFeedback(match.id, 'reported', ['Safety concern'], note)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <Flag className="w-3 h-3" />
            {t('card.report')}
          </button>
        )}
      </div>
    </article>
  );
};

export default CuratedMatchCard;
