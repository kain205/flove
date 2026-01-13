import { useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LoginForm from '../components/LoginForm';
import { authService } from '@/services/authService';
import { User } from '@/types';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

const LoginPage = ({ onLoginSuccess }: LoginPageProps) => {
  const { t } = useTranslation('auth');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const user = await authService.login({ email, password });
      authService.saveUser(user);
      onLoginSuccess(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-soft flex flex-col relative overflow-hidden">
      {/* Aurora mesh background */}
      <div className="absolute inset-0 bg-aurora pointer-events-none" />
      
      {/* Floating decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Heart className="absolute top-32 left-[10%] w-10 h-10 text-primary/10 floating-heart" style={{ animationDelay: '0s' }} />
        <Sparkles className="absolute top-48 right-[15%] w-8 h-8 text-accent/15 floating-heart" style={{ animationDelay: '0.5s' }} />
        <Heart className="absolute bottom-40 left-[20%] w-12 h-12 text-rose/10 floating-heart" style={{ animationDelay: '1s' }} />
        <Heart className="absolute bottom-60 right-[25%] w-8 h-8 text-coral/10 floating-heart" style={{ animationDelay: '1.5s' }} />
      </div>
      
      {/* Header */}
      <header className="p-6 relative z-10">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-card group-hover:shadow-glow transition-shadow duration-300">
            <Heart className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
          </div>
          <span className="font-serif text-xl font-bold text-foreground">F-Connect</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 pb-12 relative z-10">
        <div className="w-full max-w-md">
          {/* Welcome Text */}
          <div className="text-center mb-10 animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blush/80 backdrop-blur-sm text-deep-rose text-sm font-semibold mb-5 shadow-soft border border-rose/10">
              <Sparkles className="w-4 h-4" />
              Chào mừng trở lại
            </div>
            <h1 className="font-serif text-4xl font-bold text-foreground mb-3">
              {t('loginPage.title')}
            </h1>
            <p className="text-muted-foreground text-lg">
              {t('loginPage.subtitle')}
            </p>
          </div>

          {/* Login Card - Enhanced glassmorphism */}
          <div className="glass-card rounded-3xl p-8 shadow-float animate-slide-up-delay-1">
            <LoginForm
              onSubmit={handleLogin}
              isLoading={isLoading}
              error={error}
            />
          </div>

          {/* Footer Text */}
          <p className="text-center text-sm text-muted-foreground mt-8 animate-slide-up-delay-2">
            {t('loginPage.footer')}
          </p>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
