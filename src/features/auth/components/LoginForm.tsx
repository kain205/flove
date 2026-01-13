import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, GraduationCap, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LoginFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const LoginForm = ({ onSubmit, isLoading, error }: LoginFormProps) => {
  const { t } = useTranslation('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(email, password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Email Field */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-foreground font-semibold text-sm">
          {t('loginForm.emailLabel')}
        </Label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-focus-within:bg-primary/20 transition-colors duration-300">
            <Mail className="w-4 h-4 text-primary" />
          </div>
          <Input
            id="email"
            type="email"
            placeholder={t('loginForm.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="pl-16 h-14 rounded-xl bg-muted/30 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300"
            required
          />
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5 pl-1">
          <GraduationCap className="w-3.5 h-3.5 text-primary" />
          {t('loginForm.emailHint')}
        </p>
      </div>

      {/* Password Field */}
      <div className="space-y-2">
        <Label htmlFor="password" className="text-foreground font-semibold text-sm">
          {t('loginForm.passwordLabel')}
        </Label>
        <div className="relative group">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-focus-within:bg-primary/20 transition-colors duration-300">
            <Lock className="w-4 h-4 text-primary" />
          </div>
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder={t('loginForm.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-16 pr-14 h-14 rounded-xl bg-muted/30 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300"
            required
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-300 cursor-pointer"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 animate-scale-in">
          <p className="text-sm text-destructive font-medium">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isLoading}
        className="w-full h-14 rounded-xl gradient-primary text-primary-foreground font-semibold text-base shadow-card hover:shadow-float transition-all duration-300 btn-shine cursor-pointer group"
      >
        {isLoading ? (
          <span className="flex items-center gap-3">
            <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            {t('loginForm.signingIn')}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            {t('loginForm.signIn')}
            <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        )}
      </Button>

      {/* Divider */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border/50" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="glass px-4 py-1 rounded-full text-muted-foreground font-medium">{t('loginForm.newToFConnect')}</span>
        </div>
      </div>

      {/* Sign Up Link */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-14 rounded-xl border-2 border-primary/20 text-primary font-semibold hover:bg-primary/5 hover:border-primary/40 transition-all duration-300 cursor-pointer"
      >
        {t('loginForm.createAccount')}
      </Button>
    </form>
  );
};

export default LoginForm;
