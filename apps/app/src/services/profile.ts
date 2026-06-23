import { calculateProfileCompleteness, normalizeProfileText, type UserProfile } from '@flove/core';
import { getCurrentProfile } from '@flove/supabase';
import { supabase } from '@/lib/supabase';

export async function loadCurrentProfile() {
  return getCurrentProfile(supabase);
}

export async function saveProfile(profile: Partial<UserProfile>) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const profileText = normalizeProfileText(profile);
  const payload = {
    id: auth.user.id,
    email: auth.user.email ?? profile.email ?? '',
    name: profile.name ?? '',
    age: profile.age ?? 0,
    major: profile.major ?? 'SE',
    campus: profile.campus ?? 'HCM',
    avatar_url: profile.avatarUrl ?? '',
    bio: profileText.bio,
    interests: profile.interests ?? [],
    personality_tags: profile.personalityTags ?? [],
    dating_goals: profile.datingGoals ?? [],
    preferred_vibes: profile.preferredVibes ?? [],
    profile_text: profileText,
    profile_completeness: calculateProfileCompleteness({
      ...profile,
      profileText,
      bio: profileText.bio,
    }),
    onboarding_source: profile.onboardingSource ?? 'manual',
  };

  const { error } = await (supabase.from('profiles') as any).upsert(payload);
  if (error) throw error;
}
