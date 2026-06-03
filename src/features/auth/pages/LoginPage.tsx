import { useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authService } from '@/services/authService';
import { User } from '@/types';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
  onNavigateToSignup?: () => void;
}

function formatAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === 'auth/unauthorized-domain') {
    return `Firebase chưa authorize domain ${window.location.hostname}. Thêm domain này trong Firebase Authentication > Settings > Authorized domains.`;
  }

  return error instanceof Error ? error.message : 'Đăng nhập thất bại';
}

const LoginPage = ({ onLoginSuccess }: LoginPageProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const user = await authService.loginWithGoogle();
      onLoginSuccess(user);
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-soft flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-aurora pointer-events-none" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Heart className="absolute top-32 left-[10%] w-10 h-10 text-primary/10 floating-heart" style={{ animationDelay: '0s' }} />
        <Sparkles className="absolute top-48 right-[15%] w-8 h-8 text-accent/15 floating-heart" style={{ animationDelay: '0.5s' }} />
        <Heart className="absolute bottom-40 left-[20%] w-12 h-12 text-rose/10 floating-heart" style={{ animationDelay: '1s' }} />
        <Heart className="absolute bottom-60 right-[25%] w-8 h-8 text-coral/10 floating-heart" style={{ animationDelay: '1.5s' }} />
      </div>

      <header className="p-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-card">
            <Heart className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
          </div>
          <span className="font-serif text-xl font-bold text-foreground">F-Love</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-12 relative z-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-10 animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blush/80 backdrop-blur-sm text-deep-rose text-sm font-semibold mb-5 shadow-soft border border-rose/10">
              <Sparkles className="w-4 h-4" />
              Dành riêng cho sinh viên FPT
            </div>
            <h1 className="font-serif text-4xl font-bold text-foreground mb-3">
              Chào mừng đến<br />F-Love
            </h1>
            <p className="text-muted-foreground text-lg">
              Kết nối và tìm kiếm tình yêu
            </p>
          </div>

          <div className="glass-card rounded-3xl p-8 shadow-float animate-slide-up-delay-1 space-y-4">
            {error && (
              <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive font-medium">{error}</p>
              </div>
            )}

            <Button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full h-14 rounded-xl bg-card border-2 border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all duration-300 text-foreground font-semibold text-base cursor-pointer flex items-center gap-3"
              variant="outline"
            >
              {isLoading ? (
                <span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {isLoading ? 'Đang đăng nhập...' : 'Tiếp tục với Google'}
            </Button>

          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
