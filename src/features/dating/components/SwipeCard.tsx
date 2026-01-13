import { Heart, X, MapPin, GraduationCap, Building2, Sparkles } from 'lucide-react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Profile } from '@/types';

interface SwipeCardProps {
  profile: Profile;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}

const SWIPE_THRESHOLD = 100; // pixels

const SwipeCard = ({ 
  profile, 
  onSwipeLeft, 
  onSwipeRight
}: SwipeCardProps) => {
  const { t } = useTranslation(['dating', 'common']);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);
  const opacity = useTransform(
    x,
    [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
    [0.7, 1, 0.7]
  );

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD) {
      onSwipeRight();
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      onSwipeLeft();
    }
  };

  return (
    <motion.div 
      className="absolute inset-0 w-full max-w-sm mx-auto cursor-grab active:cursor-grabbing"
      style={{ x, rotate, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      animate={{ scale: 1 }}
      exit={{
        x: x.get() > 0 ? 400 : -400,
        opacity: 0,
        transition: { duration: 0.3, ease: 'easeOut' }
      }}
    >
      <div className="relative h-[520px] rounded-3xl overflow-hidden shadow-float bg-card border border-border/20">
        {/* Profile Image */}
        <img
          src={profile.avatar}
          alt={profile.name}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Enhanced Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/95 via-foreground/30 via-50% to-transparent" />
        
        {/* Subtle top gradient for status indicators */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-foreground/30 to-transparent" />

        {/* Swipe Indicators - Enhanced styling */}
        <motion.div
          className="absolute top-10 left-6 px-6 py-3 rounded-2xl bg-green-500/90 backdrop-blur-sm border-2 border-green-400 rotate-[-15deg] select-none shadow-lg"
          style={{ opacity: useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]) }}
        >
          <span className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <Heart className="w-6 h-6 fill-white" />
            {t('dating:swipeCard.like')}
          </span>
        </motion.div>
        <motion.div
          className="absolute top-10 right-6 px-6 py-3 rounded-2xl bg-red-500/90 backdrop-blur-sm border-2 border-red-400 rotate-[15deg] select-none shadow-lg"
          style={{ opacity: useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]) }}
        >
          <span className="text-2xl font-bold text-white tracking-wide flex items-center gap-2">
            <X className="w-6 h-6" />
            {t('dating:swipeCard.nope')}
          </span>
        </motion.div>

        {/* Online Indicator - Enhanced */}
        {profile.isOnline && (
          <div className="absolute top-5 right-5 flex items-center gap-2 glass px-4 py-2 rounded-full shadow-soft">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <span className="text-xs font-semibold text-foreground">{t('common:status.online')}</span>
          </div>
        )}

        {/* Profile Info - Enhanced typography and spacing */}
        <div className="absolute bottom-0 left-0 right-0 p-7 text-primary-foreground">
          <div className="flex items-end justify-between">
            <div className="flex-1">
              <h2 className="font-serif text-4xl font-bold drop-shadow-lg">
                {profile.name}, <span className="font-sans font-normal text-3xl opacity-90">{profile.age}</span>
              </h2>
              
              <div className="flex items-center gap-5 mt-3 flex-wrap">
                <div className="flex items-center gap-2 text-primary-foreground/90">
                  <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{t(`common:majors.${profile.major}`)}</span>
                </div>
                <div className="flex items-center gap-2 text-primary-foreground/90">
                  <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{t('dating:swipeCard.campus', { campus: profile.campus })}</span>
                </div>
              </div>

              {profile.distance && (
                <div className="flex items-center gap-2 mt-3 text-primary-foreground/80">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{t('dating:swipeCard.away', { distance: profile.distance })}</span>
                </div>
              )}

              <p className="mt-4 text-sm text-primary-foreground/85 line-clamp-2 leading-relaxed">
                {profile.bio}
              </p>

              {/* Interests - Enhanced chips */}
              <div className="flex gap-2 mt-4 flex-wrap">
                {profile.interests.slice(0, 3).map((interest) => (
                  <span
                    key={interest}
                    className="px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold text-primary-foreground border border-white/20 shadow-sm"
                  >
                    {interest}
                  </span>
                ))}
                {profile.interests.length > 3 && (
                  <span className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-xs font-medium text-primary-foreground/80">
                    +{profile.interests.length - 3}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons - Enhanced with better animations */}
      <div className="flex justify-center items-center gap-8 mt-8">
        <motion.button
          onClick={onSwipeLeft}
          whileHover={{ scale: 1.1, rotate: -5 }}
          whileTap={{ scale: 0.9 }}
          className="w-16 h-16 rounded-full glass-card shadow-card flex items-center justify-center transition-all duration-300 hover:shadow-float group cursor-pointer border border-border/50"
        >
          <X className="w-7 h-7 text-muted-foreground group-hover:text-destructive transition-colors duration-300" />
        </motion.button>
        
        {/* Super Like button */}
        <motion.button
          whileHover={{ scale: 1.1, y: -4 }}
          whileTap={{ scale: 0.9 }}
          className="w-12 h-12 rounded-full bg-blue-500 shadow-card flex items-center justify-center transition-all duration-300 hover:shadow-float cursor-pointer"
        >
          <Sparkles className="w-5 h-5 text-white" />
        </motion.button>
        
        <motion.button
          onClick={onSwipeRight}
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          className="w-20 h-20 rounded-full gradient-primary shadow-card flex items-center justify-center transition-all duration-300 hover:shadow-float pulse-glow cursor-pointer"
        >
          <Heart className="w-9 h-9 text-primary-foreground fill-primary-foreground" />
        </motion.button>
      </div>
    </motion.div>
  );
};

export default SwipeCard;
