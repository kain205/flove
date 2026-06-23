import { useState } from 'react';
import { Camera, LogOut, Save, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db, storage } from '@/lib/firebase';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User } from '@/types';
import { useAuth } from '@/features/auth/useAuth';
import { isMockMode, saveMockUser } from '@/services/mockService';
import { saveCachedProfile } from '@/services/profileCacheService';
import { debugLog, debugWarn, elapsedMs, startTimer } from '@/lib/debugLog';
import {
  buildProfileSavePayload,
  CAMPUSES,
  DATING_GOALS,
  getProfileReadiness,
  INTERESTS,
  MAJORS,
  normalizeProfileText,
  PERSONALITY_TAGS,
  PREFERRED_VIBES,
  SAMPLE_PROFILE,
} from '@/services/profileService';
import ProfileCompletenessChecklist from '../components/ProfileCompletenessChecklist';

interface ProfilePageProps {
  user: User;
  onUserUpdate: (user: User) => void;
  onNavigateToAiPicks?: () => void;
}

const FIRESTORE_SYNC_WAIT_MS = 10000;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Không đọc được ảnh.'));
    };
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
    reader.readAsDataURL(file);
  });
}

function waitForPendingSync(ms: number): Promise<'pending'> {
  return new Promise(resolve => {
    window.setTimeout(() => resolve('pending'), ms);
  });
}

const ProfilePage = ({ user, onUserUpdate, onNavigateToAiPicks }: ProfilePageProps) => {
  const { signOut } = useAuth();
  const initialProfileText = normalizeProfileText(user);
  const [name, setName] = useState(user.name);
  const [age, setAge] = useState(user.age ? String(user.age) : '');
  const [campus, setCampus] = useState(user.campus);
  const [major, setMajor] = useState(user.major);
  const [bio, setBio] = useState(initialProfileText.bio);
  const [weekendStyle, setWeekendStyle] = useState(initialProfileText.weekendStyle ?? '');
  const [conversationStyle, setConversationStyle] = useState(initialProfileText.conversationStyle ?? '');
  const [memorableThing, setMemorableThing] = useState(initialProfileText.memorableThing ?? '');
  const [relationshipIntent, setRelationshipIntent] = useState(initialProfileText.relationshipIntent ?? '');
  const [interests, setInterests] = useState<string[]>(user.interests);
  const [personalityTags, setPersonalityTags] = useState<string[]>(user.personalityTags ?? []);
  const [datingGoals, setDatingGoals] = useState<string[]>(user.datingGoals ?? []);
  const [preferredVibes, setPreferredVibes] = useState<string[]>(user.preferredVibes ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const draftUser = {
    ...user,
    name,
    age: parseInt(age) || 0,
    campus,
    major,
    bio,
    interests,
    personalityTags,
    datingGoals,
    preferredVibes,
    profileText: {
      bio,
      weekendStyle,
      conversationStyle,
      memorableThing,
      relationshipIntent,
    },
  } as User;
  const readiness = getProfileReadiness(draftUser);

  const toggleLimited = (value: string, selected: string[], setSelected: (next: string[]) => void, limit: number) => {
    setSelected(
      selected.includes(value)
        ? selected.filter(item => item !== value)
        : selected.length < limit ? [...selected, value] : selected
    );
  };

  const applySampleProfile = () => {
    setAge(String(SAMPLE_PROFILE.age));
    setCampus(SAMPLE_PROFILE.campus);
    setMajor(SAMPLE_PROFILE.major);
    setBio(SAMPLE_PROFILE.bio);
    setInterests(SAMPLE_PROFILE.interests);
    setPersonalityTags(SAMPLE_PROFILE.personalityTags);
    setDatingGoals(SAMPLE_PROFILE.datingGoals);
    setPreferredVibes(SAMPLE_PROFILE.preferredVibes);
    setWeekendStyle(SAMPLE_PROFILE.profileText.weekendStyle);
    setConversationStyle(SAMPLE_PROFILE.profileText.conversationStyle);
    setMemorableThing(SAMPLE_PROFILE.profileText.memorableThing);
    setRelationshipIntent(SAMPLE_PROFILE.profileText.relationshipIntent);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    setError(null);
    try {
      if (isMockMode()) {
        const avatarUrl = await readFileAsDataUrl(file);
        const updated = { ...user, avatar: avatarUrl };
        saveMockUser(updated);
        onUserUpdate(updated);
        return;
      }

      const storageRef = ref(storage, `avatars/${user.id}`);
      await uploadBytes(storageRef, file);
      const avatarUrl = await getDownloadURL(storageRef);
      const updated = { ...user, avatar: avatarUrl };
      await updateDoc(doc(db, 'users', user.id), { avatar: avatarUrl, updatedAt: serverTimestamp() });
      saveCachedProfile(updated, false);
      onUserUpdate(updated);
    } catch (error) {
      console.error('Failed to upload profile photo', error);
      setError(error instanceof Error ? error.message : 'Không upload được ảnh.');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);
    setError(null);
    setSaveHint(null);
    setSaved(false);
    const updates = buildProfileSavePayload(user, {
      name,
      age: parseInt(age) || 0,
      campus,
      major,
      bio,
      interests,
      personalityTags,
      datingGoals,
      preferredVibes,
      profileText: {
        bio,
        weekendStyle,
        conversationStyle,
        memorableThing,
        relationshipIntent,
      },
    }, user.onboardingSource ?? 'manual');
    const updated = { ...user, ...updates };

    try {
      const startedAt = startTimer();
      debugLog('profile', 'save start', {
        userId: user.id,
        profileCompleteness: updates.profileCompleteness,
        payloadKeys: Object.keys(updates),
      });

      onUserUpdate(updated);
      saveCachedProfile(updated, !isMockMode());

      if (isMockMode()) {
        saveMockUser(updated);
      } else {
        const syncPromise = setDoc(
          doc(db, 'users', user.id),
          { ...updates, updatedAt: serverTimestamp() },
          { merge: true }
        );
        const syncResult = await Promise.race([
          syncPromise.then(() => 'synced' as const),
          waitForPendingSync(FIRESTORE_SYNC_WAIT_MS),
        ]);

        if (syncResult === 'pending') {
          setSaveHint('Đã cập nhật trong app. Firebase vẫn đang đồng bộ nền; nếu reload ngay có thể thấy dữ liệu cũ.');
          setSaved(true);
          void syncPromise
            .then(() => {
              debugLog('profile', 'background save done', {
                elapsedMs: elapsedMs(startedAt),
                userId: user.id,
              });
              setSaveHint(null);
              saveCachedProfile(updated, false);
              setSaved(true);
              setTimeout(() => setSaved(false), 2000);
            })
            .catch(error => {
              debugWarn('profile', 'background save failed', {
                userId: user.id,
                error: error instanceof Error ? error.message : String(error),
              });
              console.error('Failed to sync profile in background', error);
              setSaveHint(null);
              setError(
                error instanceof Error
                  ? `Profile đã cập nhật trong app nhưng Firebase chưa nhận: ${error.message}`
                  : 'Profile đã cập nhật trong app nhưng Firebase chưa nhận.'
              );
            });
          return;
        }
      }
      debugLog('profile', 'save done', {
        elapsedMs: elapsedMs(startedAt),
        userId: user.id,
      });
      setSaveHint(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      debugWarn('profile', 'save failed', {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error('Failed to save profile', error);
      setSaveHint(null);
      setError(
        error instanceof Error
          ? `Profile đã cập nhật trong app nhưng Firebase chưa nhận: ${error.message}`
          : 'Profile đã cập nhật trong app nhưng Firebase chưa nhận.'
      );
    } finally {
      setIsSaving(false);
    }
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
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-foreground">Thông tin cá nhân</h3>
            <Button
              type="button"
              variant="outline"
              onClick={applySampleProfile}
              className="h-9 rounded-xl text-xs border-primary/30 text-primary hover:bg-primary/10"
            >
              Autofill sample
            </Button>
          </div>

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
            maxLength={240}
            className="w-full rounded-xl bg-muted/30 border border-border/50 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none text-sm"
          />
          <p className="text-xs text-muted-foreground text-right">{bio.length}/240</p>
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
                onClick={() => toggleLimited(interest, interests, setInterests, 8)}
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

        <div className="glass-card rounded-2xl p-5 shadow-card space-y-3">
          <Label className="font-semibold text-foreground">AI matching signals</Label>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Vibe của bạn</p>
            <div className="flex flex-wrap gap-2">
              {PERSONALITY_TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleLimited(tag, personalityTags, setPersonalityTags, 4)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    personalityTags.includes(tag)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Bạn muốn tìm gì?</p>
            <div className="flex flex-wrap gap-2">
              {DATING_GOALS.map(goal => (
                <button
                  key={goal}
                  type="button"
                  onClick={() => toggleLimited(goal, datingGoals, setDatingGoals, 3)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    datingGoals.includes(goal)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {goal}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Kiểu người/vibe bạn dễ hợp</p>
            <div className="flex flex-wrap gap-2">
              {PREFERRED_VIBES.map(vibe => (
                <button
                  key={vibe}
                  type="button"
                  onClick={() => toggleLimited(vibe, preferredVibes, setPreferredVibes, 4)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                    preferredVibes.includes(vibe)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {vibe}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-5 shadow-card space-y-3">
          <Label className="font-semibold text-foreground">Quick questions</Label>
          <textarea
            value={weekendStyle}
            onChange={e => setWeekendStyle(e.target.value)}
            placeholder="Cuối tuần bạn thường làm gì?"
            rows={2}
            maxLength={180}
            className="w-full rounded-xl bg-muted/30 border border-border/50 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none text-sm"
          />
          <textarea
            value={conversationStyle}
            onChange={e => setConversationStyle(e.target.value)}
            placeholder="Bạn thích kiểu nói chuyện nào?"
            rows={2}
            maxLength={180}
            className="w-full rounded-xl bg-muted/30 border border-border/50 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none text-sm"
          />
          <textarea
            value={memorableThing}
            onChange={e => setMemorableThing(e.target.value)}
            placeholder="Bạn muốn người khác nhớ gì về bạn?"
            rows={2}
            maxLength={180}
            className="w-full rounded-xl bg-muted/30 border border-border/50 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none text-sm"
          />
          <textarea
            value={relationshipIntent}
            onChange={e => setRelationshipIntent(e.target.value)}
            placeholder="Bạn đang tìm điều gì trên F-Love?"
            rows={2}
            maxLength={180}
            className="w-full rounded-xl bg-muted/30 border border-border/50 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none text-sm"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </div>
        )}

        {saveHint && !error && (
          <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
            {saveHint}
          </div>
        )}

        <div className="glass-card rounded-2xl p-5 shadow-card space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-foreground">Profile completeness</span>
              <span className="font-semibold text-primary">{readiness.completeness}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${readiness.completeness}%` }}
              />
            </div>
          </div>

          <ProfileCompletenessChecklist readiness={readiness} layout="grid" />
        </div>

        {/* Save button */}
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full h-14 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-card hover:shadow-float transition-all duration-300 disabled:opacity-100 disabled:cursor-wait"
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Đang lưu...
            </span>
          ) : saved ? (
            <span className="flex items-center gap-2">
              <Save className="w-5 h-5" /> Đã lưu!
            </span>
          ) : (
            'Lưu thay đổi'
          )}
        </Button>

        {saved && readiness.isComplete && onNavigateToAiPicks && (
          <Button
            type="button"
            variant="outline"
            onClick={onNavigateToAiPicks}
            className="w-full h-12 rounded-xl border-primary/30 text-primary hover:bg-primary/10 font-medium"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Xem AI Picks
          </Button>
        )}

        {/* Logout */}
        <Button
          variant="ghost"
          onClick={() => void signOut()}
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
