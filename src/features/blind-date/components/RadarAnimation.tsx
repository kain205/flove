interface RadarAnimationProps {
  isSearching: boolean;
}

const RadarAnimation = ({ isSearching }: RadarAnimationProps) => {
  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      {/* Outer Pulse Rings */}
      {isSearching && (
        <>
          <div className="absolute inset-0 rounded-full border-2 border-primary/30 radar-pulse" />
          <div className="absolute inset-0 rounded-full border-2 border-primary/20 radar-pulse-delay-1" />
          <div className="absolute inset-0 rounded-full border-2 border-primary/10 radar-pulse-delay-2" />
        </>
      )}

      {/* Center Circle */}
      <div 
        className={`
          relative w-32 h-32 rounded-full gradient-primary shadow-float
          flex items-center justify-center
          ${isSearching ? 'animate-pulse' : ''}
        `}
      >
        {/* Radar Sweep */}
        {isSearching && (
          <div 
            className="absolute inset-0 rounded-full overflow-hidden"
            style={{
              background: 'conic-gradient(from 0deg, transparent 0deg, hsl(var(--primary) / 0.3) 60deg, transparent 120deg)',
              animation: 'spin 2s linear infinite',
            }}
          />
        )}

        {/* Icon */}
        <div className="relative z-10">
          {isSearching ? (
            <div className="w-12 h-12 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            </div>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-12 h-12 text-primary-foreground"
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
              <line x1="12" y1="2" x2="12" y2="4" />
              <line x1="12" y1="20" x2="12" y2="22" />
              <line x1="2" y1="12" x2="4" y2="12" />
              <line x1="20" y1="12" x2="22" y2="12" />
            </svg>
          )}
        </div>
      </div>

      {/* Floating Dots */}
      {isSearching && (
        <>
          <div 
            className="absolute w-3 h-3 rounded-full bg-accent shadow-sm"
            style={{
              top: '20%',
              left: '25%',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
          <div 
            className="absolute w-2 h-2 rounded-full bg-primary shadow-sm"
            style={{
              top: '35%',
              right: '20%',
              animation: 'pulse 1.5s ease-in-out 0.3s infinite',
            }}
          />
          <div 
            className="absolute w-2.5 h-2.5 rounded-full bg-coral shadow-sm"
            style={{
              bottom: '30%',
              left: '15%',
              animation: 'pulse 1.5s ease-in-out 0.6s infinite',
            }}
          />
        </>
      )}
    </div>
  );
};

export default RadarAnimation;
