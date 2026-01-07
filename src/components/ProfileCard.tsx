import { Heart, X, Star, MapPin } from "lucide-react";

interface ProfileCardProps {
  name: string;
  age: number;
  location: string;
  image: string;
  bio: string;
  isMain?: boolean;
}

const ProfileCard = ({ name, age, location, image, bio, isMain = false }: ProfileCardProps) => {
  return (
    <div 
      className={`
        relative overflow-hidden rounded-3xl shadow-card 
        transition-all duration-500 hover:shadow-float hover:-translate-y-2
        ${isMain ? 'w-full max-w-sm' : 'w-full max-w-xs'}
      `}
    >
      {/* Image Container */}
      <div className="relative aspect-[3/4] overflow-hidden">
        <img 
          src={image} 
          alt={name}
          className="w-full h-full object-cover"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-transparent to-transparent" />
        
        {/* Profile Info */}
        <div className="absolute bottom-0 left-0 right-0 p-5 text-primary-foreground">
          <h3 className="font-serif text-2xl font-semibold">
            {name}, <span className="font-sans font-normal">{age}</span>
          </h3>
          <div className="flex items-center gap-1 mt-1 text-primary-foreground/80">
            <MapPin className="w-4 h-4" />
            <span className="text-sm">{location}</span>
          </div>
          <p className="mt-2 text-sm text-primary-foreground/70 line-clamp-2">
            {bio}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      {isMain && (
        <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-4 px-5">
          <button className="p-4 rounded-full bg-card shadow-card transition-all hover:scale-110 hover:shadow-float group">
            <X className="w-7 h-7 text-muted-foreground group-hover:text-destructive transition-colors" />
          </button>
          <button className="p-4 rounded-full gradient-primary shadow-card transition-all hover:scale-110 hover:shadow-float pulse-glow">
            <Heart className="w-7 h-7 text-primary-foreground" />
          </button>
          <button className="p-4 rounded-full bg-card shadow-card transition-all hover:scale-110 hover:shadow-float group">
            <Star className="w-7 h-7 text-muted-foreground group-hover:text-accent transition-colors" />
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileCard;
