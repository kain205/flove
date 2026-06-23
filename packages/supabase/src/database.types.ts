export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & Pick<ProfileRow, 'id' | 'email'>;
        Update: Partial<ProfileRow>;
      };
      preference_profiles: {
        Row: PreferenceProfileRow;
        Insert: Partial<PreferenceProfileRow> & Pick<PreferenceProfileRow, 'user_id'>;
        Update: Partial<PreferenceProfileRow>;
      };
      daily_match_batches: {
        Row: DailyMatchBatchRow;
        Insert: Partial<DailyMatchBatchRow> & Pick<DailyMatchBatchRow, 'id' | 'user_id' | 'date'>;
        Update: Partial<DailyMatchBatchRow>;
      };
      curated_matches: {
        Row: CuratedMatchRow;
        Insert: Partial<CuratedMatchRow> & Pick<CuratedMatchRow, 'id' | 'batch_id' | 'user_id' | 'candidate_id' | 'pair_key'>;
        Update: Partial<CuratedMatchRow>;
      };
      match_feedback: {
        Row: MatchFeedbackRow;
        Insert: Pick<MatchFeedbackRow, 'match_id' | 'user_id' | 'candidate_id' | 'decision'> & Partial<MatchFeedbackRow>;
        Update: never;
      };
      matches: {
        Row: MatchRow;
        Insert: never;
        Update: never;
      };
      conversations: {
        Row: ConversationRow;
        Insert: never;
        Update: never;
      };
      conversation_participants: {
        Row: ConversationParticipantRow;
        Insert: never;
        Update: never;
      };
      messages: {
        Row: MessageRow;
        Insert: Pick<MessageRow, 'conversation_id' | 'content'> & Partial<MessageRow>;
        Update: Partial<Pick<MessageRow, 'is_read'>>;
      };
      reports: {
        Row: ReportRow;
        Insert: Pick<ReportRow, 'reported_user_id' | 'reason'> & Partial<ReportRow>;
        Update: never;
      };
      blocks: {
        Row: BlockRow;
        Insert: Pick<BlockRow, 'blocked_user_id'> & Partial<BlockRow>;
        Update: never;
      };
      preference_chat_messages: {
        Row: PreferenceChatMessageRow;
        Insert: Pick<PreferenceChatMessageRow, 'user_id' | 'sender' | 'content'> & Partial<PreferenceChatMessageRow>;
        Update: never;
      };
      blind_date_queue: {
        Row: BlindDateQueueRow;
        Insert: Pick<BlindDateQueueRow, 'user_id' | 'masked_name'> & Partial<BlindDateQueueRow>;
        Update: Partial<Pick<BlindDateQueueRow, 'status' | 'queued_at'>>;
      };
      blind_date_sessions: {
        Row: BlindDateSessionRow;
        Insert: Pick<BlindDateSessionRow, 'id' | 'user_ids'> & Partial<BlindDateSessionRow>;
        Update: Partial<Pick<BlindDateSessionRow, 'reveal_requests' | 'is_revealed' | 'conversation_id'>>;
      };
      moderation_events: {
        Row: ModerationEventRow;
        Insert: never;
        Update: never;
      };
      user_safety_actions: {
        Row: UserSafetyActionRow;
        Insert: never;
        Update: never;
      };
    };
    Views: {
      public_profiles: {
        Row: PublicProfileRow;
      };
    };
    Functions: {
      accept_curated_match: {
        Args: { p_match_id: string; p_tags?: string[]; p_note?: string };
        Returns: { is_mutual: boolean; conversation_id: string | null };
      };
    };
  };
}

export interface ProfileRow {
  id: string;
  email: string;
  name: string;
  age: number;
  major: 'SE' | 'AI' | 'Biz' | 'Design' | 'Marketing';
  campus: 'HCM' | 'Hanoi' | 'Danang' | 'Cantho';
  avatar_url: string;
  bio: string;
  interests: string[];
  personality_tags: string[];
  dating_goals: string[];
  preferred_vibes: string[];
  profile_text: Json;
  profile_completeness: number;
  onboarding_source: 'manual' | 'sample_autofill';
  ai_signals: Json;
  created_at: string;
  updated_at: string;
}

export type PublicProfileRow = Pick<
  ProfileRow,
  | 'id'
  | 'name'
  | 'age'
  | 'major'
  | 'campus'
  | 'avatar_url'
  | 'bio'
  | 'interests'
  | 'personality_tags'
  | 'dating_goals'
  | 'preferred_vibes'
  | 'profile_text'
  | 'profile_completeness'
>;

export interface PreferenceProfileRow {
  id: string;
  user_id: string;
  summary: string;
  hard_filters: string[];
  soft_preferences: string[];
  feedback_summary: string[];
  updated_at: string;
}

export interface DailyMatchBatchRow {
  id: string;
  user_id: string;
  date: string;
  target_count: number;
  generated_by: string;
  created_at: string;
}

export interface CuratedMatchRow {
  id: string;
  batch_id: string;
  user_id: string;
  candidate_id: string;
  candidate_snapshot: Json;
  pair_key: string;
  ai_reason: string;
  compatibility_label: string;
  compatibility_score: number;
  status: 'pending' | 'accepted' | 'declined' | 'skipped' | 'reported' | 'matched';
  feedback_tags: string[];
  feedback_note: string | null;
  created_at: string;
  decided_at: string | null;
}

export interface MatchFeedbackRow {
  id: string;
  match_id: string;
  user_id: string;
  candidate_id: string;
  decision: 'accepted' | 'declined' | 'skipped' | 'reported';
  tags: string[];
  note: string | null;
  created_at: string;
}

export interface MatchRow {
  id: string;
  pair_key: string;
  source: 'ai-curated' | 'blind-date';
  is_revealed: boolean;
  matched_at: string;
}

export interface ConversationRow {
  id: string;
  match_id: string | null;
  pair_key: string | null;
  is_anonymous: boolean;
  last_message: Json;
  updated_at: string;
}

export interface ConversationParticipantRow {
  conversation_id: string;
  user_id: string;
  unread_count: number;
  masked_name: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read: boolean;
}

export interface ReportRow {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  conversation_id: string | null;
  curated_match_id: string | null;
  reason: string;
  note: string | null;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  created_at: string;
}

export interface BlockRow {
  blocker_id: string;
  blocked_user_id: string;
  reason: string | null;
  created_at: string;
}

export interface PreferenceChatMessageRow {
  id: string;
  user_id: string;
  sender: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface BlindDateQueueRow {
  user_id: string;
  masked_name: string;
  status: 'waiting' | 'matched' | 'cancelled';
  queued_at: string;
}

export interface BlindDateSessionRow {
  id: string;
  conversation_id: string | null;
  user_ids: string[];
  partner_masked_names: Json;
  reveal_requests: Json;
  is_revealed: boolean;
  created_at: string;
}

export interface ModerationEventRow {
  id: string;
  actor_id: string | null;
  target_user_id: string | null;
  report_id: string | null;
  event_type: 'report_created' | 'block_created' | 'message_flagged' | 'profile_flagged' | 'safety_action_applied';
  metadata: Json;
  created_at: string;
}

export interface UserSafetyActionRow {
  id: string;
  user_id: string;
  action: 'warning' | 'temporary_restriction' | 'shadow_review' | 'suspension' | 'ban';
  status: 'active' | 'expired' | 'revoked';
  reason: string | null;
  metadata: Json;
  created_at: string;
  expires_at: string | null;
}
