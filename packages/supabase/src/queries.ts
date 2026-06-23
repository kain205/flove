import { localDateKey, type CuratedMatch, type DailyMatchBatch, type UserProfile } from '@flove/core';
import type { FloveSupabaseClient } from './client';
import { curatedMatchFromRow, dailyMatchBatchFromRows, userProfileFromRow } from './mappers';

export async function getCurrentProfile(client: FloveSupabaseClient): Promise<UserProfile | null> {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? userProfileFromRow(data) : null;
}

export async function getTodayMatches(client: FloveSupabaseClient, date = localDateKey()): Promise<DailyMatchBatch | null> {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');
  const batchId = `${auth.user.id}_${date}`;

  const { data: batch, error: batchError } = await client
    .from('daily_match_batches')
    .select('*')
    .eq('id', batchId)
    .maybeSingle();
  if (batchError) throw batchError;
  if (!batch) return null;

  const { data: matches, error: matchesError } = await client
    .from('curated_matches')
    .select('*')
    .eq('batch_id', batchId)
    .order('compatibility_score', { ascending: false });
  if (matchesError) throw matchesError;

  return dailyMatchBatchFromRows(batch, (matches ?? []).map(row => curatedMatchFromRow(row)));
}

export async function getCuratedMatch(client: FloveSupabaseClient, matchId: string): Promise<CuratedMatch> {
  const { data, error } = await client
    .from('curated_matches')
    .select('*')
    .eq('id', matchId)
    .single();
  if (error) throw error;
  return curatedMatchFromRow(data);
}
