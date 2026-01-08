import { useState } from 'react';
import { Heart } from 'lucide-react';
import LoginForm from '../components/LoginForm';
import { authService } from '@/services/authService';
import { User } from '@/types';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
}

const LoginPage = ({ onLoginSuccess }: LoginPageProps) => {
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
    <div className="min-h-screen gradient-soft flex flex-col">
      {/* Header */}
      <header className="p-6">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-card">
            <Heart className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
          </div>
          <span className="font-serif text-xl font-bold text-foreground">F-Connect</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md">
          {/* Welcome Text */}
          <div className="text-center mb-8 animate-slide-up">
            <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
              Welcome Back
            </h1>
            <p className="text-muted-foreground">
              Sign in to find your perfect match at FPT
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-card rounded-3xl p-8 shadow-card animate-slide-up-delay-1">
            <LoginForm
              onSubmit={handleLogin}
              isLoading={isLoading}
              error={error}
            />
          </div>

          {/* Footer Text */}
          <p className="text-center text-xs text-muted-foreground mt-6 animate-slide-up-delay-2">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;
