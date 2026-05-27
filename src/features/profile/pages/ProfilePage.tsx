import { useState } from 'react';
import { Camera, LogOut, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/services/authService';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User } from '@/types';

const CAMPUSES = ['HCM', 'Hanoi', 'Danang', 'Cantho'] as const;
const MAJORS = ['SE', 'AI', 'Biz', 'Design', 'Marketing'] as const;
const INTERESTS = [
  'Coding', 'Gaming', 'Music', 'Photography', 'Travel',
  'Reading', 'Sports', 'Art', 'Coffee', 'Movies',
  'Yoga', 'Dance', 'Cooking', 'AI/ML', 'Startups',
  'Fashion', 'Basketball', 'Finance', 'Marketing',
];

interface ProfilePageProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

const ProfilePage = ({ user, onUserUpdate }: ProfilePageProps) => {
  const [name, setName] = useState(user.name);
  const [age, setAge] = useState(user.age ? String(user.age) : '');
  const [campus, setCampus] = useState(user.campus);
  const [major, setMajor] = useState(user.major);
  const [bio, setBio] = useState(user.bio);
  const [interests, setInterests] = useState<string[]>(user.interests);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : prev.length < 8 ? [...prev, interest] : prev
    );
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const storageRef = ref(storage, `avatars/${user.id}`);
      await uploadBytes(storageRef, file);
      const avatarUrl = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'users', user.id), { avatar: avatarUrl });
      const updated = { ...user, avatar: avatarUrl };
      localStorage.setItem('flove-user', JSON.stringify(updated));
      onUserUpdate(updated);
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const updates = {
      name,
      age: parseInt(age) || 0,
      campus,
      major,
      bio,
      interests,
    };
    // Optimistic update
    const updated = { ...user, ...updates };
    localStorage.setItem('flove-user', JSON.stringify(updated));
    onUserUpdate(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    // Save to Firestore in background
    updateDoc(doc(db, 'users', user.id), updates)
      .catch(console.error)
      .finally(() => setIsSaving(false));
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      {/* Header with avatar */}
      <div className="relative gradient-primary pt-12 pb-16 px-6 text-center">
        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white/30 shadow-float mx-auto">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-white/20 flex items-center justify-center text-white text-3xl font-bold">
                {user.name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
          </div>
          <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-card shadow-card flex items-center justify-center cursor-pointer hover:bg-muted transition-colors">
            {isUploadingPhoto
              ? <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              : <Camera className="w-4 h-4 text-foreground" />
            }
            <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          </label>
        </div>
        <h2 className="text-white font-serif text-xl font-bold mt-3">{user.name}</h2>
        <p className="text-white/70 text-sm">{user.email}</p>
      </div>

      {/* Form */}
      <div className="px-4 -mt-8 pb-24 space-y-4">
        <div className="glass-card rounded-2xl p-5 shadow-card space-y-4">
          <h3 className="font-semibold text-foreground">Thông tin cá nhân</h3>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tên hiển thị</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              className="h-11 rounded-xl bg-muted/30 border-border/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tuổi</Label>
              <Input
                type="number"
                value={age}
                onChange={e => setAge(e.target.value)}
                min={17} max={30}
                className="h-11 rounded-xl bg-muted/30 border-border/50"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Campus</Label>
              <select
                value={campus}
                onChange={e => setCampus(e.target.value as typeof CAMPUSES[number])}
                className="w-full h-11 rounded-xl bg-muted/30 border border-border/50 px-3 text-foreground text-sm focus:border-primary focus:outline-none"
              >
                {CAMPUSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Ngành học</Label>
            <div className="flex flex-wrap gap-2">
              {MAJORS.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMajor(m)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    major === m
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="glass-card rounded-2xl p-5 shadow-card space-y-2">
          <Label className="font-semibold text-foreground">Bio</Label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Vài dòng về bạn..."
            rows={3}
            maxLength={200}
            className="w-full rounded-xl bg-muted/30 border border-border/50 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none text-sm"
          />
          <p className="text-xs text-muted-foreground text-right">{bio.length}/200</p>
        </div>

        {/* Interests */}
        <div className="glass-card rounded-2xl p-5 shadow-card space-y-3">
          <div className="flex items-center justify-between">
            <Label className="font-semibold text-foreground">Sở thích</Label>
            <span className="text-xs text-muted-foreground">{interests.length}/8</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map(interest => (
              <button
                key={interest}
                type="button"
                onClick={() => toggleInterest(interest)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                  interests.includes(interest)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
        </div>

        {/* Save button */}
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full h-14 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-card hover:shadow-float transition-all duration-300"
        >
          {saved ? (
            <span className="flex items-center gap-2">
              <Save className="w-5 h-5" /> Đã lưu!
            </span>
          ) : (
            'Lưu thay đổi'
          )}
        </Button>

        {/* Logout */}
        <Button
          variant="ghost"
          onClick={() => authService.logout()}
          className="w-full h-12 rounded-xl text-destructive hover:bg-destructive/10 font-medium"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Đăng xuất
        </Button>
      </div>
    </div>
  );
};

export default ProfilePage;
