import { useState, useRef } from 'react';
import { Mail, Lock, Eye, EyeOff, User, Camera, Check, ArrowRight, ArrowLeft, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FPT_EMAIL_REGEX } from '@/services/authService';
import type { SignupData } from '../pages/SignupPage';

const CAMPUSES = ['HCM', 'Hanoi', 'Danang', 'Cantho'] as const;
const MAJORS = ['SE', 'AI', 'Biz', 'Design', 'Marketing'] as const;
const INTERESTS = [
  'Coding', 'Gaming', 'Music', 'Photography', 'Travel',
  'Reading', 'Sports', 'Art', 'Coffee', 'Movies',
  'Yoga', 'Dance', 'Cooking', 'AI/ML', 'Startups',
  'Fashion', 'Basketball', 'Finance', 'Marketing',
];

interface SignupFormProps {
  onComplete: (data: SignupData) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const SignupForm = ({ onComplete, isLoading, error }: SignupFormProps) => {
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [campus, setCampus] = useState<typeof CAMPUSES[number]>('HCM');
  const [major, setMajor] = useState<typeof MAJORS[number]>('SE');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [stepErrors, setStepErrors] = useState<string | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : prev.length < 8 ? [...prev, interest] : prev
    );
  };

  const validateStep1 = (): boolean => {
    if (!FPT_EMAIL_REGEX.test(email)) {
      setStepErrors('Chỉ chấp nhận email FPT (@fpt.edu.vn)');
      return false;
    }
    if (password.length < 6) {
      setStepErrors('Mật khẩu tối thiểu 6 ký tự');
      return false;
    }
    setStepErrors(null);
    return true;
  };

  const validateStep2 = (): boolean => {
    if (!name.trim()) {
      setStepErrors('Vui lòng nhập tên');
      return false;
    }
    const ageNum = parseInt(age);
    if (isNaN(ageNum) || ageNum < 17 || ageNum > 30) {
      setStepErrors('Tuổi phải từ 17 đến 30');
      return false;
    }
    setStepErrors(null);
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const handleBack = () => {
    setStepErrors(null);
    setStep(s => s - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onComplete({
      email,
      password,
      name,
      age: parseInt(age),
      campus,
      major,
      photoFile,
      interests,
    });
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map(s => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
            s < step
              ? 'bg-primary text-primary-foreground'
              : s === step
              ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
              : 'bg-muted text-muted-foreground'
          }`}>
            {s < step ? <Check className="w-4 h-4" /> : s}
          </div>
          {s < 3 && <div className={`w-8 h-px ${s < step ? 'bg-primary' : 'bg-muted'}`} />}
        </div>
      ))}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <StepIndicator />

      {/* Step 1: Credentials */}
      {step === 1 && (
        <div className="space-y-4 animate-slide-up">
          <p className="text-sm text-muted-foreground text-center font-medium">Bước 1: Thông tin đăng nhập</p>

          <div className="space-y-2">
            <Label htmlFor="signup-email" className="text-foreground font-semibold text-sm">Email FPT</Label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mail className="w-4 h-4 text-primary" />
              </div>
              <Input
                id="signup-email"
                type="email"
                placeholder="yourname@fpt.edu.vn"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="pl-16 h-14 rounded-xl bg-muted/30 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 pl-1">
              <GraduationCap className="w-3.5 h-3.5 text-primary" />
              Chỉ chấp nhận email @fpt.edu.vn
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-password" className="text-foreground font-semibold text-sm">Mật khẩu</Label>
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Lock className="w-4 h-4 text-primary" />
              </div>
              <Input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Ít nhất 6 ký tự"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="pl-16 pr-14 h-14 rounded-xl bg-muted/30 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Profile info */}
      {step === 2 && (
        <div className="space-y-4 animate-slide-up">
          <p className="text-sm text-muted-foreground text-center font-medium">Bước 2: Thông tin cá nhân</p>

          <div className="space-y-2">
            <Label className="text-foreground font-semibold text-sm">Tên của bạn</Label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <Input
                placeholder="Tên hiển thị"
                value={name}
                onChange={e => setName(e.target.value)}
                className="pl-16 h-14 rounded-xl bg-muted/30 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-foreground font-semibold text-sm">Tuổi</Label>
              <Input
                type="number"
                placeholder="20"
                value={age}
                onChange={e => setAge(e.target.value)}
                min={17}
                max={30}
                className="h-14 rounded-xl bg-muted/30 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground font-semibold text-sm">Campus</Label>
              <select
                value={campus}
                onChange={e => setCampus(e.target.value as typeof CAMPUSES[number])}
                className="w-full h-14 rounded-xl bg-muted/30 border border-border/50 px-3 text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              >
                {CAMPUSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground font-semibold text-sm">Ngành học</Label>
            <div className="flex flex-wrap gap-2">
              {MAJORS.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMajor(m)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    major === m
                      ? 'bg-primary text-primary-foreground shadow-soft'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Step 3: Photo + Interests */}
      {step === 3 && (
        <div className="space-y-5 animate-slide-up">
          <p className="text-sm text-muted-foreground text-center font-medium">Bước 3: Ảnh & Sở thích</p>

          {/* Photo upload */}
          <div className="space-y-2">
            <Label className="text-foreground font-semibold text-sm">Ảnh đại diện</Label>
            <div className="flex items-center gap-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 rounded-2xl bg-muted/50 border-2 border-dashed border-border/50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl"
                >
                  {photoPreview ? 'Thay ảnh' : 'Chọn ảnh'}
                </Button>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG tối đa 5MB</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>

          {/* Interests */}
          <div className="space-y-2">
            <Label className="text-foreground font-semibold text-sm">
              Sở thích <span className="text-muted-foreground font-normal">(chọn tối đa 8)</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map(interest => (
                <button
                  key={interest}
                  type="button"
                  onClick={() => toggleInterest(interest)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    interests.includes(interest)
                      ? 'bg-primary text-primary-foreground shadow-soft'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{interests.length}/8 đã chọn</p>
          </div>
        </div>
      )}

      {/* Errors */}
      {(stepErrors || error) && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive font-medium">{stepErrors || error}</p>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex gap-3 pt-2">
        {step > 1 && (
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            className="flex-1 h-14 rounded-xl"
            disabled={isLoading}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </Button>
        )}

        {step < 3 ? (
          <Button
            type="button"
            onClick={handleNext}
            className="flex-1 h-14 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-card hover:shadow-float transition-all duration-300 group"
          >
            Tiếp theo
            <ArrowRight className="w-5 h-5 ml-2 transition-transform duration-300 group-hover:translate-x-1" />
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={isLoading}
            className="flex-1 h-14 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-card hover:shadow-float transition-all duration-300"
          >
            {isLoading ? (
              <span className="flex items-center gap-3">
                <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Đang tạo tài khoản...
              </span>
            ) : (
              'Hoàn tất đăng ký'
            )}
          </Button>
        )}
      </div>
    </form>
  );
};

export default SignupForm;
