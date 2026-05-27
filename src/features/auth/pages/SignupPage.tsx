import { useState } from 'react';
import { Heart, Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SignupForm from '../components/SignupForm';
import { authService } from '@/services/authService';
import { storage, db } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { User } from '@/types';

interface SignupPageProps {
  onSignupSuccess: (user: User) => void;
  onBackToLogin: () => void;
}

export interface SignupData {
  // Step 1
  email: string;
  password: string;
  // Step 2
  name: string;
  age: number;
  campus: 'HCM' | 'Hanoi' | 'Danang' | 'Cantho';
  major: 'SE' | 'AI' | 'Biz' | 'Design' | 'Marketing';
  // Step 3
  photoFile: File | null;
  interests: string[];
}

const SignupPage = ({ onSignupSuccess, onBackToLogin }: SignupPageProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async (data: SignupData) => {
    setIsLoading(true);
    setError(null);

    try {
      // First create the auth user so we have a uid
      const tempUser = await authService.signup(
        { email: data.email, password: data.password },
        {
          name: data.name,
          age: data.age,
          campus: data.campus,
          major: data.major,
          bio: '',
          interests: data.interests,
          avatar: '',
        }
      );

      // Upload photo if provided
      let avatarUrl = '';
      if (data.photoFile) {
        const storageRef = ref(storage, `avatars/${tempUser.id}`);
        await uploadBytes(storageRef, data.photoFile);
        avatarUrl = await getDownloadURL(storageRef);
        await updateDoc(doc(db, 'users', tempUser.id), { avatar: avatarUrl });
      }

      onSignupSuccess({ ...tempUser, avatar: avatarUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng ký thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-soft flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-aurora pointer-events-none" />

      {/* Header */}
      <header className="p-6 relative z-10 flex items-center gap-4">
        <button
          onClick={onBackToLogin}
          className="w-10 h-10 rounded-xl bg-card/60 backdrop-blur-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl gradient-primary flex items-center justify-center shadow-card">
            <Heart className="w-5 h-5 text-primary-foreground fill-primary-foreground" />
          </div>
          <span className="font-serif text-xl font-bold text-foreground">F-Love</span>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-6 pb-12 relative z-10 pt-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blush/80 backdrop-blur-sm text-deep-rose text-sm font-semibold mb-4 shadow-soft border border-rose/10">
              <Sparkles className="w-4 h-4" />
              Tạo tài khoản mới
            </div>
            <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
              Tham gia F-Love
            </h1>
            <p className="text-muted-foreground">
              Chỉ dành cho sinh viên FPT
            </p>
          </div>

          <div className="glass-card rounded-3xl p-6 shadow-float animate-slide-up-delay-1">
            <SignupForm
              onComplete={handleComplete}
              isLoading={isLoading}
              error={error}
            />
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Đã có tài khoản?{' '}
            <button
              onClick={onBackToLogin}
              className="text-primary font-semibold hover:underline"
            >
              Đăng nhập
            </button>
          </p>
        </div>
      </main>
    </div>
  );
};

export default SignupPage;
