import { Heart, X, MapPin, GraduationCap, Building2 } from 'lucide-react';
import { Profile } from '@/types';

interface SwipeCardProps {
  profile: Profile;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  isAnimating?: boolean;
  animationDirection?: 'left' | 'right' | null;
}

const majorLabels: Record<string, string> = {
  SE: 'Software Engineering',
  AI: 'Artificial Intelligence',
  Biz: 'Business Administration',
  Design: 'Graphic Design',
  Marketing: 'Digital Marketing',
};

const SwipeCard = ({ 
  profile, 
  onSwipeLeft, 
  onSwipeRight,
  isAnimating,
  animationDirection 
}: SwipeCardProps) => {
  return (
    <div 
      className={`
        absolute inset-0 w-full max-w-sm mx-auto
        ${isAnimating && animationDirection === 'right' ? 'swipe-right' : ''}
        ${isAnimating && animationDirection === 'left' ? 'swipe-left' : ''}
      `}
    >
      <div className="relative h-[500px] rounded-3xl overflow-hidden shadow-float bg-card">
        {/* Profile Image */}
        <img
          src={profile.avatar}
          alt={profile.name}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/90 via-foreground/20 to-transparent" />

        {/* Online Indicator */}
        {profile.isOnline && (
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-card/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-foreground">Online</span>
          </div>
        )}

        {/* Profile Info */}
        <div className="absolute bottom-0 left-0 right-0 p-6 text-primary-foreground">
          <div className="flex items-end justify-between">
            <div className="flex-1">
              <h2 className="font-serif text-3xl font-bold">
                {profile.name}, <span className="font-sans font-normal">{profile.age}</span>
              </h2>
              
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-primary-foreground/80">
                  <GraduationCap className="w-4 h-4" />
                  <span className="text-sm">{majorLabels[profile.major] || profile.major}</span>
                </div>
                <div className="flex items-center gap-1.5 text-primary-foreground/80">
                  <Building2 className="w-4 h-4" />
                  <span className="text-sm">FPT {profile.campus}</span>
                </div>
              </div>

              {profile.distance && (
                <div className="flex items-center gap-1.5 mt-2 text-primary-foreground/70">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">{profile.distance} away</span>
                </div>
              )}

              <p className="mt-3 text-sm text-primary-foreground/80 line-clamp-2">
                {profile.bio}
              </p>

              {/* Interests */}
              <div className="flex gap-2 mt-3 flex-wrap">
                {profile.interests.slice(0, 3).map((interest) => (
                  <span
                    key={interest}
                    className="px-3 py-1 rounded-full bg-primary-foreground/20 backdrop-blur-sm text-xs font-medium text-primary-foreground"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center gap-6 mt-6">
        <button
          onClick={onSwipeLeft}
          className="w-16 h-16 rounded-full bg-card shadow-card flex items-center justify-center transition-all hover:scale-110 hover:shadow-float group"
        >
          <X className="w-8 h-8 text-muted-foreground group-hover:text-destructive transition-colors" />
        </button>
        <button
          onClick={onSwipeRight}
          className="w-20 h-20 rounded-full gradient-primary shadow-card flex items-center justify-center transition-all hover:scale-110 hover:shadow-float pulse-glow"
        >
          <Heart className="w-10 h-10 text-primary-foreground fill-primary-foreground" />
        </button>
      </div>
    </div>
  );
};

export default SwipeCard;
