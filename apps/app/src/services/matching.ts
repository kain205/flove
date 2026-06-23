import { acceptCuratedMatch, generateDailyMatches, getTodayMatches, submitMatchFeedback } from '@flove/supabase';
import { supabase } from '@/lib/supabase';

export async function loadOrGenerateTodayMatches() {
  const existing = await getTodayMatches(supabase);
  if (existing && existing.matches.length > 0) return existing;
  await generateDailyMatches(supabase);
  return getTodayMatches(supabase);
}

export function acceptPick(matchId: string) {
  return acceptCuratedMatch(supabase, { matchId });
}

export function declinePick(matchId: string) {
  return submitMatchFeedback(supabase, { matchId, decision: 'declined' });
}
