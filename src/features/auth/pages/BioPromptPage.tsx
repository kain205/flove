import { useMemo, useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/firebase';
import { User } from '@/types';
import {
  buildProfileSavePayload,
  calculateProfileCompleteness,
  CAMPUSES,
  DATING_GOALS,
  INTERESTS,
  isProfileCompleteForMatching,
  MAJORS,
  normalizeProfileText,
  PERSONALITY_TAGS,
  PREFERRED_VIBES,
  profileSignalCount,
  SAMPLE_PROFILE,
} from '@/services/profileService';

interface BioPromptPageProps {
  user: User;
  onComplete: (user: User) => void;
}

function toggleLimited(value: string, selected: string[], limit: number): string[] {
  if (selected.includes(value)) return selected.filter(item => item !== value);
  if (selected.length >= limit) return selected;
  return [...selected, value];
}

const BioPromptPage = ({ user, onComplete }: BioPromptPageProps) => {
  const initialProfileText = normalizeProfileText(user);
  const [name, setName] = useState(user.name);
  const [age, setAge] = useState(user.age ? String(user.age) : '');
  const [campus, setCampus] = useState(user.campus);
  const [major, setMajor] = useState(user.major);
  const [interests, setInterests] = useState<string[]>(user.interests ?? []);
  const [personalityTags, setPersonalityTags] = useState<string[]>(user.personalityTags ?? []);
  const [datingGoals, setDatingGoals] = useState<string[]>(user.datingGoals ?? []);
  const [preferredVibes, setPreferredVibes] = useState<string[]>(user.preferredVibes ?? []);
  const [bio, setBio] = useState(initialProfileText.bio);
  const [weekendStyle, setWeekendStyle] = useState(initialProfileText.weekendStyle ?? '');
  const [conversationStyle, setConversationStyle] = useState(initialProfileText.conversationStyle ?? '');
  const [memorableThing, setMemorableThing] = useState(initialProfileText.memorableThing ?? '');
  const [relationshipIntent, setRelationshipIntent] = useState(initialProfileText.relationshipIntent ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<User['onboardingSource']>('manual');

  const draftUser = useMemo<User>(() => ({
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
    onboardingSource: source,
  }), [
    age,
    bio,
    campus,
    conversationStyle,
    datingGoals,
    interests,
    major,
    memorableThing,
    name,
    personalityTags,
    preferredVibes,
    relationshipIntent,
    source,
    user,
    weekendStyle,
  ]);

  const completeness = calculateProfileCompleteness(draftUser);
  const canSave = isProfileCompleteForMatching(draftUser);
  const missingItems = [
    !draftUser.age || draftUser.age < 17 ? 'tuổi từ 17 trở lên' : null,
    interests.length < 3 ? 'ít nhất 3 sở thích' : null,
    profileSignalCount(draftUser) < 1 ? 'ít nhất 1 đoạn mô tả/trả lời' : null,
  ].filter(Boolean);

  const handleAutofill = () => {
    setError(null);
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
    setSource('sample_autofill');
  };

  const handleSave = async () => {
    if (!canSave) {
      setError(`Bạn cần thêm ${missingItems.join(', ')} trước khi lưu.`);
      return;
    }
    setIsSaving(true);
    setError(null);

    const userPayload = buildProfileSavePayload(user, draftUser, source);
    const firestorePayload = {
      ...userPayload,
      updatedAt: serverTimestamp(),
    };
    const updated = { ...user, ...userPayload, profileCompleteness: completeness } as User;

    try {
      await setDoc(doc(db, 'users', user.id), firestorePayload, { merge: true });
      onComplete(updated);
    } catch (error) {
      console.error('Failed to save profile', error);
      setError(error instanceof Error ? error.message : 'Không lưu được profile lên Firebase.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-h-[92vh] overflow-y-auto px-4 pb-6 pt-2">
      <div className="glass-card rounded-3xl p-6 shadow-float space-y-5">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-card mx-auto mb-3">
            <Heart className="w-6 h-6 text-primary-foreground fill-primary-foreground" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-foreground mb-1">Tạo profile của bạn</h2>
          <p className="text-muted-foreground text-sm">
            Trả lời nhanh vài ý để F-Love hiểu vibe và gợi ý match tốt hơn.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleAutofill}
          variant="outline"
          className="w-full h-11 rounded-xl border-primary/30 text-primary hover:bg-primary/10"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Autofill sample profile
        </Button>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tên hiển thị</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-11 rounded-xl bg-muted/30 border-border/50" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tuổi</Label>
              <Input
                type="number"
                value={age}
                onChange={e => setAge(e.target.value)}
                min={17}
                max={30}
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

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Ngành học</Label>
            <div className="flex flex-wrap gap-2">
              {MAJORS.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMajor(item)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                    major === item ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Sở thích</Label>
              <span className="text-xs text-muted-foreground">{interests.length}/8</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setInterests(prev => toggleLimited(item, prev, 8))}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    interests.includes(item) ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Bạn thuộc vibe nào?</Label>
            <div className="flex flex-wrap gap-2">
              {PERSONALITY_TAGS.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPersonalityTags(prev => toggleLimited(item, prev, 4))}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    personalityTags.includes(item) ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Bạn muốn tìm gì?</Label>
            <div className="flex flex-wrap gap-2">
              {DATING_GOALS.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setDatingGoals(prev => toggleLimited(item, prev, 3))}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    datingGoals.includes(item) ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Kiểu người/vibe bạn dễ hợp</Label>
            <div className="flex flex-wrap gap-2">
              {PREFERRED_VIBES.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPreferredVibes(prev => toggleLimited(item, prev, 4))}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    preferredVibes.includes(item) ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">Giới thiệu ngắn hoặc trả lời vài câu dưới đây</Label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Vài dòng về bạn nếu muốn..."
              rows={3}
              maxLength={240}
              className="w-full rounded-xl bg-muted/30 border border-border/50 px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none resize-none text-sm"
            />
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
        </div>

        <div className="space-y-2">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completeness}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            Profile completeness: {completeness}%. Cần tuổi, ít nhất 3 sở thích và ít nhất 1 câu trả lời/bio để bật AI Picks.
          </p>
          {error && (
            <p className="text-xs font-medium text-destructive">
              {error}
            </p>
          )}
        </div>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full h-14 rounded-xl gradient-primary text-primary-foreground font-semibold shadow-card hover:shadow-float transition-all"
        >
          {isSaving ? 'Đang lưu...' : 'Lưu profile'}
        </Button>
      </div>
    </div>
  );
};

export default BioPromptPage;
