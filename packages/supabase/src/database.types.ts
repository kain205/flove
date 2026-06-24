export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      blind_date_queue: {
        Row: {
          masked_name: string
          queued_at: string
          status: string
          user_id: string
        }
        Insert: {
          masked_name: string
          queued_at?: string
          status?: string
          user_id: string
        }
        Update: {
          masked_name?: string
          queued_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blind_date_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blind_date_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blind_date_sessions: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          is_revealed: boolean
          partner_masked_names: Json
          reveal_requests: Json
          user_ids: string[]
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id: string
          is_revealed?: boolean
          partner_masked_names?: Json
          reveal_requests?: Json
          user_ids: string[]
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          is_revealed?: boolean
          partner_masked_names?: Json
          reveal_requests?: Json
          user_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "blind_date_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_user_id: string
          blocker_id: string
          created_at: string
          reason: string | null
        }
        Insert: {
          blocked_user_id: string
          blocker_id?: string
          created_at?: string
          reason?: string | null
        }
        Update: {
          blocked_user_id?: string
          blocker_id?: string
          created_at?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_user_id_fkey"
            columns: ["blocked_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocked_user_id_fkey"
            columns: ["blocked_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          created_at: string
          masked_name: string | null
          unread_count: number
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          masked_name?: string | null
          unread_count?: number
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          masked_name?: string | null
          unread_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          id: string
          is_anonymous: boolean
          last_message: Json | null
          match_id: string | null
          pair_key: string | null
          updated_at: string
        }
        Insert: {
          id: string
          is_anonymous?: boolean
          last_message?: Json | null
          match_id?: string | null
          pair_key?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          is_anonymous?: boolean
          last_message?: Json | null
          match_id?: string | null
          pair_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      curated_matches: {
        Row: {
          ai_reason: string
          batch_id: string
          candidate_id: string
          candidate_snapshot: Json
          compatibility_label: string
          compatibility_score: number
          created_at: string
          decided_at: string | null
          feedback_note: string | null
          feedback_tags: string[]
          id: string
          pair_key: string
          status: Database["public"]["Enums"]["curated_match_status"]
          suggested_opener: string | null
          user_id: string
        }
        Insert: {
          ai_reason: string
          batch_id: string
          candidate_id: string
          candidate_snapshot: Json
          compatibility_label: string
          compatibility_score: number
          created_at?: string
          decided_at?: string | null
          feedback_note?: string | null
          feedback_tags?: string[]
          id: string
          pair_key: string
          status?: Database["public"]["Enums"]["curated_match_status"]
          suggested_opener?: string | null
          user_id: string
        }
        Update: {
          ai_reason?: string
          batch_id?: string
          candidate_id?: string
          candidate_snapshot?: Json
          compatibility_label?: string
          compatibility_score?: number
          created_at?: string
          decided_at?: string | null
          feedback_note?: string | null
          feedback_tags?: string[]
          id?: string
          pair_key?: string
          status?: Database["public"]["Enums"]["curated_match_status"]
          suggested_opener?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curated_matches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "daily_match_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curated_matches_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curated_matches_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curated_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curated_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_match_batches: {
        Row: {
          created_at: string
          date: string
          generated_by: string
          id: string
          target_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          generated_by?: string
          id: string
          target_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          generated_by?: string
          id?: string
          target_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_match_batches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_match_batches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_feedback: {
        Row: {
          candidate_id: string
          created_at: string
          decision: Database["public"]["Enums"]["feedback_decision"]
          id: string
          match_id: string
          note: string | null
          tags: string[]
          user_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          decision: Database["public"]["Enums"]["feedback_decision"]
          id?: string
          match_id: string
          note?: string | null
          tags?: string[]
          user_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          decision?: Database["public"]["Enums"]["feedback_decision"]
          id?: string
          match_id?: string
          note?: string | null
          tags?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_feedback_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "curated_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          id: string
          is_revealed: boolean
          matched_at: string
          pair_key: string
          source: Database["public"]["Enums"]["match_source"]
        }
        Insert: {
          id: string
          is_revealed?: boolean
          matched_at?: string
          pair_key: string
          source?: Database["public"]["Enums"]["match_source"]
        }
        Update: {
          id?: string
          is_revealed?: boolean
          matched_at?: string
          pair_key?: string
          source?: Database["public"]["Enums"]["match_source"]
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["moderation_event_type"]
          id: string
          metadata: Json
          report_id: string | null
          target_user_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["moderation_event_type"]
          id?: string
          metadata?: Json
          report_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["moderation_event_type"]
          id?: string
          metadata?: Json
          report_id?: string | null
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "moderation_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_events_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_events_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moderation_events_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      preference_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preference_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preference_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      preference_profiles: {
        Row: {
          feedback_summary: string[]
          hard_filters: string[]
          id: string
          soft_preferences: string[]
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          feedback_summary?: string[]
          hard_filters?: string[]
          id?: string
          soft_preferences?: string[]
          summary?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          feedback_summary?: string[]
          hard_filters?: string[]
          id?: string
          soft_preferences?: string[]
          summary?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preference_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preference_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number
          age_pref_max: number | null
          age_pref_min: number | null
          ai_profile_analysis: Json
          ai_signals: Json
          appearance_preference: Json
          avatar_url: string
          bio: string
          campus: Database["public"]["Enums"]["campus"]
          communication_vector: string | null
          created_at: string
          dating_goals: string[]
          dealbreakers: Json
          email: string
          gender: Database["public"]["Enums"]["gender"]
          gender_text: string | null
          height_cm: number | null
          id: string
          interests: string[]
          lifestyle_vector: string | null
          looking_for_gender: string[]
          major: Database["public"]["Enums"]["major"]
          name: string
          need_vector: string | null
          onboarding_source: Database["public"]["Enums"]["onboarding_source"]
          personality_tags: string[]
          preference_vector: string | null
          preferred_vibes: string[]
          profile_completeness: number
          profile_confirmed: boolean
          profile_confirmed_at: string | null
          profile_text: Json
          self_vector: string | null
          updated_at: string
        }
        Insert: {
          age?: number
          age_pref_max?: number | null
          age_pref_min?: number | null
          ai_profile_analysis?: Json
          ai_signals?: Json
          appearance_preference?: Json
          avatar_url?: string
          bio?: string
          campus?: Database["public"]["Enums"]["campus"]
          communication_vector?: string | null
          created_at?: string
          dating_goals?: string[]
          dealbreakers?: Json
          email: string
          gender?: Database["public"]["Enums"]["gender"]
          gender_text?: string | null
          height_cm?: number | null
          id: string
          interests?: string[]
          lifestyle_vector?: string | null
          looking_for_gender?: string[]
          major?: Database["public"]["Enums"]["major"]
          name?: string
          need_vector?: string | null
          onboarding_source?: Database["public"]["Enums"]["onboarding_source"]
          personality_tags?: string[]
          preference_vector?: string | null
          preferred_vibes?: string[]
          profile_completeness?: number
          profile_confirmed?: boolean
          profile_confirmed_at?: string | null
          profile_text?: Json
          self_vector?: string | null
          updated_at?: string
        }
        Update: {
          age?: number
          age_pref_max?: number | null
          age_pref_min?: number | null
          ai_profile_analysis?: Json
          ai_signals?: Json
          appearance_preference?: Json
          avatar_url?: string
          bio?: string
          campus?: Database["public"]["Enums"]["campus"]
          communication_vector?: string | null
          created_at?: string
          dating_goals?: string[]
          dealbreakers?: Json
          email?: string
          gender?: Database["public"]["Enums"]["gender"]
          gender_text?: string | null
          height_cm?: number | null
          id?: string
          interests?: string[]
          lifestyle_vector?: string | null
          looking_for_gender?: string[]
          major?: Database["public"]["Enums"]["major"]
          name?: string
          need_vector?: string | null
          onboarding_source?: Database["public"]["Enums"]["onboarding_source"]
          personality_tags?: string[]
          preference_vector?: string | null
          preferred_vibes?: string[]
          profile_completeness?: number
          profile_confirmed?: boolean
          profile_confirmed_at?: string | null
          profile_text?: Json
          self_vector?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          conversation_id: string | null
          created_at: string
          curated_match_id: string | null
          id: string
          note: string | null
          reason: string
          reported_user_id: string
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          curated_match_id?: string | null
          id?: string
          note?: string | null
          reason: string
          reported_user_id: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          curated_match_id?: string | null
          id?: string
          note?: string | null
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_curated_match_id_fkey"
            columns: ["curated_match_id"]
            isOneToOne: false
            referencedRelation: "curated_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_safety_actions: {
        Row: {
          action: Database["public"]["Enums"]["safety_action_type"]
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json
          reason: string | null
          status: Database["public"]["Enums"]["safety_action_status"]
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["safety_action_type"]
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          status?: Database["public"]["Enums"]["safety_action_status"]
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["safety_action_type"]
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json
          reason?: string | null
          status?: Database["public"]["Enums"]["safety_action_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_safety_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_safety_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          age: number | null
          avatar_url: string | null
          bio: string | null
          campus: Database["public"]["Enums"]["campus"] | null
          dating_goals: string[] | null
          gender: Database["public"]["Enums"]["gender"] | null
          height_cm: number | null
          id: string | null
          interests: string[] | null
          major: Database["public"]["Enums"]["major"] | null
          name: string | null
          personality_tags: string[] | null
          preferred_vibes: string[] | null
          profile_completeness: number | null
          profile_text: Json | null
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          bio?: string | null
          campus?: Database["public"]["Enums"]["campus"] | null
          dating_goals?: string[] | null
          gender?: Database["public"]["Enums"]["gender"] | null
          height_cm?: number | null
          id?: string | null
          interests?: string[] | null
          major?: Database["public"]["Enums"]["major"] | null
          name?: string | null
          personality_tags?: string[] | null
          preferred_vibes?: string[] | null
          profile_completeness?: number | null
          profile_text?: Json | null
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          bio?: string | null
          campus?: Database["public"]["Enums"]["campus"] | null
          dating_goals?: string[] | null
          gender?: Database["public"]["Enums"]["gender"] | null
          height_cm?: number | null
          id?: string | null
          interests?: string[] | null
          major?: Database["public"]["Enums"]["major"] | null
          name?: string | null
          personality_tags?: string[] | null
          preferred_vibes?: string[] | null
          profile_completeness?: number | null
          profile_text?: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_curated_match: {
        Args: { p_match_id: string; p_note?: string; p_tags?: string[] }
        Returns: {
          conversation_id: string
          is_mutual: boolean
        }[]
      }
      get_match_candidates: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          age: number
          ai_profile_analysis: Json
          appearance_preference: Json
          avatar_url: string
          bio: string
          campus: Database["public"]["Enums"]["campus"]
          communication_vector: number[]
          dating_goals: string[]
          dealbreakers: Json
          gender: Database["public"]["Enums"]["gender"]
          height_cm: number
          id: string
          interests: string[]
          lifestyle_vector: number[]
          looking_for_gender: string[]
          major: Database["public"]["Enums"]["major"]
          name: string
          need_vector: number[]
          personality_tags: string[]
          preference_vector: number[]
          preferred_vibes: string[]
          profile_completeness: number
          profile_text: Json
          self_vector: number[]
        }[]
      }
      pair_key_for: { Args: { a: string; b: string }; Returns: string }
    }
    Enums: {
      campus: "HCM" | "Hanoi" | "Danang" | "Cantho"
      curated_match_status:
        | "pending"
        | "accepted"
        | "declined"
        | "skipped"
        | "reported"
        | "matched"
      feedback_decision: "accepted" | "declined" | "skipped" | "reported"
      gender: "male" | "female" | "other" | "prefer_not_to_show"
      major: "SE" | "AI" | "Biz" | "Design" | "Marketing"
      match_source: "ai-curated" | "blind-date"
      moderation_event_type:
        | "report_created"
        | "block_created"
        | "message_flagged"
        | "profile_flagged"
        | "safety_action_applied"
      onboarding_source: "manual" | "sample_autofill"
      report_status: "open" | "reviewing" | "resolved" | "dismissed"
      safety_action_status: "active" | "expired" | "revoked"
      safety_action_type:
        | "warning"
        | "temporary_restriction"
        | "shadow_review"
        | "suspension"
        | "ban"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      campus: ["HCM", "Hanoi", "Danang", "Cantho"],
      curated_match_status: [
        "pending",
        "accepted",
        "declined",
        "skipped",
        "reported",
        "matched",
      ],
      feedback_decision: ["accepted", "declined", "skipped", "reported"],
      gender: ["male", "female", "other", "prefer_not_to_show"],
      major: ["SE", "AI", "Biz", "Design", "Marketing"],
      match_source: ["ai-curated", "blind-date"],
      moderation_event_type: [
        "report_created",
        "block_created",
        "message_flagged",
        "profile_flagged",
        "safety_action_applied",
      ],
      onboarding_source: ["manual", "sample_autofill"],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      safety_action_status: ["active", "expired", "revoked"],
      safety_action_type: [
        "warning",
        "temporary_restriction",
        "shadow_review",
        "suspension",
        "ban",
      ],
    },
  },
} as const
