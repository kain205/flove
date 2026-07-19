import { normalizeProfileText, type UserProfile } from '@flove/core';
import { getCurrentProfile } from '@flove/supabase';
import { supabase } from '@/lib/supabase';

export const profileQueryKey = (userId: string | null | undefined) => ['profile', userId ?? 'anonymous'] as const;

export async function loadCurrentProfile(expectedUserId?: string) {
  return getCurrentProfile(supabase, expectedUserId);
}

export async function saveProfile(profile: Partial<UserProfile>) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const profileText = {
    ...normalizeProfileText(profile),
    bio: profile.bio ?? profile.profileText?.bio ?? '',
  };
  const payload = {
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
    gender: profile.gender ?? 'prefer_not_to_show',
    gender_text: profile.gender === 'other' ? profile.genderText ?? null : null,
    looking_for_gender: profile.lookingForGender ?? [],
    height_cm: profile.heightCm ?? null,
    age_pref_min: profile.agePref?.min ?? null,
    age_pref_max: profile.agePref?.max ?? null,
  };

  // Readiness/completeness, AI analysis and revisions are server-owned. Profile
  // edits use only the explicitly granted display/discovery columns.
  const { data, error } = await supabase.from('profiles')
    .update(payload)
    .eq('id', auth.user.id)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Profile not found. Complete onboarding first.');
}
