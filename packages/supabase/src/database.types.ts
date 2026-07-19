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
      ai_assistant_requests: {
        Row: {
          claim_token: string
          claimed_at: string
          client_request_id: string
          completed_at: string | null
          expires_at: string | null
          provider_started_at: string | null
          request_fingerprint: string
          response_payload: Json | null
          scope: string
          status: string
          user_id: string
        }
        Insert: {
          claim_token?: string
          claimed_at?: string
          client_request_id: string
          completed_at?: string | null
          expires_at?: string | null
          provider_started_at?: string | null
          request_fingerprint: string
          response_payload?: Json | null
          scope: string
          status?: string
          user_id: string
        }
        Update: {
          claim_token?: string
          claimed_at?: string
          client_request_id?: string
          completed_at?: string | null
          expires_at?: string | null
          provider_started_at?: string | null
          request_fingerprint?: string
          response_payload?: Json | null
          scope?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_assistant_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_assistant_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_job_registry: {
        Row: {
          completed_at: string | null
          created_at: string
          idempotency_key: string
          job_type: string
          msg_id: number | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          idempotency_key: string
          job_type: string
          msg_id?: number | null
          status?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          idempotency_key?: string
          job_type?: string
          msg_id?: number | null
          status?: string
        }
        Relationships: []
      }
      ai_pick_product_config: {
        Row: {
          mode: Database["public"]["Enums"]["ai_pick_product_mode"]
          price_vnd: number
          singleton: boolean
          updated_at: string
        }
        Insert: {
          mode?: Database["public"]["Enums"]["ai_pick_product_mode"]
          price_vnd?: number
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          mode?: Database["public"]["Enums"]["ai_pick_product_mode"]
          price_vnd?: number
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      ai_pick_trial_claims: {
        Row: {
          batch_id: string
          claimed_at: string
          user_id: string
        }
        Insert: {
          batch_id: string
          claimed_at?: string
          user_id: string
        }
        Update: {
          batch_id?: string
          claimed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_pick_trial_claims_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: true
            referencedRelation: "daily_match_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_pick_trial_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_pick_trial_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_pick_unlock_ledger: {
        Row: {
          amount_vnd: number
          batch_id: string
          created_at: string
          id: string
          idempotency_key: string
          product_key: string
          source: string
          user_id: string
        }
        Insert: {
          amount_vnd: number
          batch_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          product_key?: string
          source?: string
          user_id: string
        }
        Update: {
          amount_vnd?: number
          batch_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          product_key?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_pick_unlock_ledger_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "daily_match_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_pick_unlock_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_pick_unlock_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_rate_limit_buckets: {
        Row: {
          request_count: number
          scope: string
          updated_at: string
          user_id: string
          window_start: string
        }
        Insert: {
          request_count?: number
          scope: string
          updated_at?: string
          user_id: string
          window_start: string
        }
        Update: {
          request_count?: number
          scope?: string
          updated_at?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
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
      candidate_pool_state: {
        Row: {
          revision: number
          singleton: boolean
          updated_at: string
        }
        Insert: {
          revision?: number
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          revision?: number
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
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
      course_enrollments: {
        Row: {
          client_request_id: string
          completed_at: string | null
          course_id: string
          current_lesson: number
          enrolled_at: string
          progress_percent: number
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_request_id: string
          completed_at?: string | null
          course_id: string
          current_lesson?: number
          enrolled_at?: string
          progress_percent?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_request_id?: string
          completed_at?: string | null
          course_id?: string
          current_lesson?: number
          enrolled_at?: string
          progress_percent?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "learning_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lesson_progress: {
        Row: {
          completed_at: string
          course_id: string
          is_correct: boolean
          lesson_id: string
          reflection: string
          selected_answer: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          course_id: string
          is_correct: boolean
          lesson_id: string
          reflection?: string
          selected_answer: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string
          course_id?: string
          is_correct?: boolean
          lesson_id?: string
          reflection?: string
          selected_answer?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_lesson_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "learning_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "learning_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_lesson_progress_user_id_course_id_fkey"
            columns: ["user_id", "course_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["user_id", "course_id"]
          },
          {
            foreignKeyName: "course_lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_lesson_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
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
          preview_id: string
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
          preview_id?: string
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
          preview_id?: string
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
          access_assigned_at: string
          access_state: Database["public"]["Enums"]["ai_pick_batch_access_state"]
          algorithm_version: string
          attempt_count: number
          candidate_pool_revision: number
          claim_token: string | null
          created_at: string
          date: string
          empty_reason: string | null
          enriched_at: string | null
          enrichment_error_code: string | null
          enrichment_status: Database["public"]["Enums"]["match_enrichment_status"]
          error_code: string | null
          finalized_at: string | null
          generated_by: string
          generation_started_at: string | null
          id: string
          profile_revision: number
          retry_after: string | null
          status: Database["public"]["Enums"]["daily_match_batch_status"]
          target_count: number
          teaser_preview_id: string | null
          unlock_source: string | null
          unlocked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_assigned_at?: string
          access_state?: Database["public"]["Enums"]["ai_pick_batch_access_state"]
          algorithm_version?: string
          attempt_count?: number
          candidate_pool_revision?: number
          claim_token?: string | null
          created_at?: string
          date: string
          empty_reason?: string | null
          enriched_at?: string | null
          enrichment_error_code?: string | null
          enrichment_status?: Database["public"]["Enums"]["match_enrichment_status"]
          error_code?: string | null
          finalized_at?: string | null
          generated_by?: string
          generation_started_at?: string | null
          id: string
          profile_revision?: number
          retry_after?: string | null
          status?: Database["public"]["Enums"]["daily_match_batch_status"]
          target_count?: number
          teaser_preview_id?: string | null
          unlock_source?: string | null
          unlocked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_assigned_at?: string
          access_state?: Database["public"]["Enums"]["ai_pick_batch_access_state"]
          algorithm_version?: string
          attempt_count?: number
          candidate_pool_revision?: number
          claim_token?: string | null
          created_at?: string
          date?: string
          empty_reason?: string | null
          enriched_at?: string | null
          enrichment_error_code?: string | null
          enrichment_status?: Database["public"]["Enums"]["match_enrichment_status"]
          error_code?: string | null
          finalized_at?: string | null
          generated_by?: string
          generation_started_at?: string | null
          id?: string
          profile_revision?: number
          retry_after?: string | null
          status?: Database["public"]["Enums"]["daily_match_batch_status"]
          target_count?: number
          teaser_preview_id?: string | null
          unlock_source?: string | null
          unlocked_at?: string | null
          updated_at?: string
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
      learning_courses: {
        Row: {
          content_version: number
          created_at: string
          description: string
          duration_minutes: number
          id: string
          is_free: boolean
          lesson_count: number
          published_at: string | null
          slug: string
          source_links: Json
          status: string
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          content_version?: number
          created_at?: string
          description?: string
          duration_minutes: number
          id: string
          is_free?: boolean
          lesson_count: number
          published_at?: string | null
          slug: string
          source_links?: Json
          status?: string
          subtitle?: string
          title: string
          updated_at?: string
        }
        Update: {
          content_version?: number
          created_at?: string
          description?: string
          duration_minutes?: number
          id?: string
          is_free?: boolean
          lesson_count?: number
          published_at?: string | null
          slug?: string
          source_links?: Json
          status?: string
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      learning_lessons: {
        Row: {
          content_blocks: Json
          course_id: string
          created_at: string
          duration_minutes: number
          eyebrow: string
          id: string
          position: number
          quiz: Json
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          content_blocks: Json
          course_id: string
          created_at?: string
          duration_minutes: number
          eyebrow?: string
          id: string
          position: number
          quiz: Json
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          content_blocks?: Json
          course_id?: string
          created_at?: string
          duration_minutes?: number
          eyebrow?: string
          id?: string
          position?: number
          quiz?: Json
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "learning_courses"
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
          idempotency_key: string | null
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
          idempotency_key?: string | null
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
          idempotency_key?: string | null
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
      match_generation_attempts: {
        Row: {
          attempt_no: number
          batch_id: string
          candidate_count: number
          duration_ms: number | null
          error_code: string | null
          finished_at: string | null
          id: number
          outcome: string
          selected_count: number
          started_at: string
          user_id: string
        }
        Insert: {
          attempt_no: number
          batch_id: string
          candidate_count?: number
          duration_ms?: number | null
          error_code?: string | null
          finished_at?: string | null
          id?: never
          outcome?: string
          selected_count?: number
          started_at?: string
          user_id: string
        }
        Update: {
          attempt_no?: number
          batch_id?: string
          candidate_count?: number
          duration_ms?: number | null
          error_code?: string | null
          finished_at?: string | null
          id?: never
          outcome?: string
          selected_count?: number
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_generation_attempts_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "daily_match_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_generation_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_generation_attempts_user_id_fkey"
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
          client_message_id: string | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          client_message_id?: string | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id?: string
        }
        Update: {
          client_message_id?: string | null
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
      onboarding_drafts: {
        Row: {
          analysis: Json | null
          analysis_revision: number | null
          analysis_source: string | null
          created_at: string
          draft: Json
          draft_revision: number
          onboarding_version: number
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis?: Json | null
          analysis_revision?: number | null
          analysis_source?: string | null
          created_at?: string
          draft?: Json
          draft_revision?: number
          onboarding_version?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis?: Json | null
          analysis_revision?: number | null
          analysis_source?: string | null
          created_at?: string
          draft?: Json
          draft_revision?: number
          onboarding_version?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      preference_chat_messages: {
        Row: {
          client_request_id: string | null
          content: string
          created_at: string
          id: string
          request_payload: Json | null
          sender: string
          user_id: string
        }
        Insert: {
          client_request_id?: string | null
          content: string
          created_at?: string
          id?: string
          request_payload?: Json | null
          sender: string
          user_id: string
        }
        Update: {
          client_request_id?: string | null
          content?: string
          created_at?: string
          id?: string
          request_payload?: Json | null
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
          soft_avoidances: string[]
          soft_preferences: string[]
          summary: string
          updated_at: string
          user_id: string
        }
        Insert: {
          feedback_summary?: string[]
          hard_filters?: string[]
          id?: string
          soft_avoidances?: string[]
          soft_preferences?: string[]
          summary?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          feedback_summary?: string[]
          hard_filters?: string[]
          id?: string
          soft_avoidances?: string[]
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
          embedding_error_code: string | null
          embedding_revision: number
          embedding_status: Database["public"]["Enums"]["embedding_job_status"]
          embedding_updated_at: string | null
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
          onboarding_answers: Json
          onboarding_source: Database["public"]["Enums"]["onboarding_source"]
          onboarding_version: number
          personality_tags: string[]
          preference_vector: string | null
          preferred_vibes: string[]
          profile_completeness: number
          profile_confirmed: boolean
          profile_confirmed_at: string | null
          profile_revision: number
          profile_text: Json
          profile_upgrade_required: boolean
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
          embedding_error_code?: string | null
          embedding_revision?: number
          embedding_status?: Database["public"]["Enums"]["embedding_job_status"]
          embedding_updated_at?: string | null
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
          onboarding_answers?: Json
          onboarding_source?: Database["public"]["Enums"]["onboarding_source"]
          onboarding_version?: number
          personality_tags?: string[]
          preference_vector?: string | null
          preferred_vibes?: string[]
          profile_completeness?: number
          profile_confirmed?: boolean
          profile_confirmed_at?: string | null
          profile_revision?: number
          profile_text?: Json
          profile_upgrade_required?: boolean
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
          embedding_error_code?: string | null
          embedding_revision?: number
          embedding_status?: Database["public"]["Enums"]["embedding_job_status"]
          embedding_updated_at?: string | null
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
          onboarding_answers?: Json
          onboarding_source?: Database["public"]["Enums"]["onboarding_source"]
          onboarding_version?: number
          personality_tags?: string[]
          preference_vector?: string | null
          preferred_vibes?: string[]
          profile_completeness?: number
          profile_confirmed?: boolean
          profile_confirmed_at?: string | null
          profile_revision?: number
          profile_text?: Json
          profile_upgrade_required?: boolean
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
      abandon_ai_assistant_request: {
        Args: {
          p_claim_token: string
          p_client_request_id: string
          p_expected_user_id: string
          p_request_fingerprint: string
          p_scope: string
        }
        Returns: boolean
      }
      accept_curated_match: {
        Args: { p_match_id: string; p_note?: string; p_tags?: string[] }
        Returns: {
          conversation_id: string
          is_mutual: boolean
        }[]
      }
      archive_ai_job: { Args: { p_msg_id: number }; Returns: boolean }
      assert_onboarding_draft_v2: {
        Args: { p_draft: Json }
        Returns: undefined
      }
      before_user_created_require_fpt: { Args: { event: Json }; Returns: Json }
      claim_ai_assistant_request: {
        Args: {
          p_client_request_id: string
          p_expected_user_id: string
          p_request_fingerprint: string
          p_scope: string
        }
        Returns: {
          claim_token: string
          request_status: string
          response_payload: Json
        }[]
      }
      claim_ai_rate_limit: {
        Args: {
          p_limit: number
          p_scope: string
          p_user_id: string
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          reset_at: string
        }[]
      }
      claim_daily_match_batch: {
        Args: {
          p_algorithm_version?: string
          p_stale_after_seconds?: number
          p_user_id: string
        }
        Returns: {
          attempt_count: number
          batch_id: string
          batch_status: Database["public"]["Enums"]["daily_match_batch_status"]
          business_date: string
          candidate_pool_revision: number
          claim_token: string
          missing_requirements: string[]
          profile_revision: number
          result: string
          retry_after: string
        }[]
      }
      complete_daily_match_enrichment: {
        Args: {
          p_attempt_count: number
          p_batch_id: string
          p_error_code?: string
          p_updates: Json
        }
        Returns: Database["public"]["Enums"]["match_enrichment_status"]
      }
      complete_learning_lesson: {
        Args: {
          p_course_id: string
          p_lesson_id: string
          p_reflection?: string
          p_selected_answer: number
        }
        Returns: {
          completed_at: string
          course_id: string
          current_lesson: number
          enrollment_status: string
          is_correct: boolean
          lesson_completed: boolean
          lesson_id: string
          progress_percent: number
        }[]
      }
      complete_profile_embedding_job: {
        Args: {
          p_error_code?: string
          p_profile_revision: number
          p_user_id: string
          p_vectors: Json
        }
        Returns: boolean
      }
      confirm_onboarding_profile_atomic: {
        Args: {
          p_analysis_revision: number
          p_draft_revision: number
          p_profile: Json
          p_user_id: string
        }
        Returns: Json
      }
      delete_ai_job: { Args: { p_msg_id: number }; Returns: boolean }
      enqueue_ai_job: {
        Args: {
          p_delay_seconds?: number
          p_idempotency_key?: string
          p_message: Json
        }
        Returns: number
      }
      enroll_free_learning_course: {
        Args: { p_client_request_id: string; p_course_id: string }
        Returns: {
          applied: boolean
          course_id: string
          current_lesson: number
          enrolled_at: string
          enrollment_status: string
          progress_percent: number
        }[]
      }
      fail_daily_match_batch: {
        Args: {
          p_batch_id: string
          p_candidate_count?: number
          p_claim_token: string
          p_duration_ms?: number
          p_error_code: string
          p_retry_after_seconds?: number
        }
        Returns: {
          batch_id: string
          batch_status: Database["public"]["Enums"]["daily_match_batch_status"]
          retry_after: string
        }[]
      }
      finalize_ai_assistant_request: {
        Args: {
          p_claim_token: string
          p_client_request_id: string
          p_expected_user_id: string
          p_request_fingerprint: string
          p_response_payload: Json
          p_scope: string
        }
        Returns: {
          request_status: string
          response_payload: Json
        }[]
      }
      finalize_daily_match_batch: {
        Args: {
          p_batch_id: string
          p_candidate_count?: number
          p_claim_token: string
          p_duration_ms?: number
          p_empty_reason?: string
          p_empty_retry_seconds?: number
          p_generated_by?: string
          p_matches: Json
          p_user_id: string
        }
        Returns: {
          batch_id: string
          batch_status: Database["public"]["Enums"]["daily_match_batch_status"]
          business_date: string
          enrichment_status: Database["public"]["Enums"]["match_enrichment_status"]
          match_count: number
        }[]
      }
      finalize_preference_coach_request: {
        Args: {
          p_claim_token: string
          p_client_request_id: string
          p_content: string
          p_expected_user_id: string
          p_request_fingerprint: string
          p_response_payload: Json
          p_update_memory: boolean
        }
        Returns: {
          assistant_message_id: string
          request_status: string
          response_payload: Json
          user_message_id: string
        }[]
      }
      find_blind_date_partner_atomic: {
        Args: { p_masked_name: string }
        Returns: {
          conversation_id: string
          partner_masked_name: string
          session_id: string
          waiting: boolean
        }[]
      }
      find_blind_date_partner_atomic_internal: {
        Args: { p_masked_name: string }
        Returns: {
          conversation_id: string
          partner_id: string
          partner_masked_name: string
          session_id: string
          waiting: boolean
        }[]
      }
      flove_business_date: { Args: never; Returns: string }
      get_backend_v2_alerts: {
        Args: never
        Returns: {
          code: string
          observed_at: string
          observed_value: number
          severity: string
          threshold_value: number
        }[]
      }
      get_blind_date_session: {
        Args: { p_session_id: string }
        Returns: {
          conversation_id: string
          is_revealed: boolean
          partner_id: string
          partner_masked_name: string
          requested_by_me: boolean
          requested_by_partner: boolean
          session_id: string
        }[]
      }
      get_blind_date_session_for_conversation: {
        Args: { p_conversation_id: string }
        Returns: {
          conversation_id: string
          is_revealed: boolean
          partner_id: string
          partner_masked_name: string
          requested_by_me: boolean
          requested_by_partner: boolean
          session_id: string
        }[]
      }
      get_conversation_wingman_context: {
        Args: {
          p_conversation_id: string
          p_expected_user_id: string
          p_limit?: number
        }
        Returns: {
          eligibility_reason: string
          eligible: boolean
          is_anonymous: boolean
          messages: Json
          self_context: Json
          user_age: number
        }[]
      }
      get_daily_match_rows_v2: {
        Args: { p_batch_id: string; p_user_id: string }
        Returns: {
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
          preview_id: string
          status: Database["public"]["Enums"]["curated_match_status"]
          suggested_opener: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "curated_matches"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_daily_picks_safe: {
        Args: { p_batch_id: string; p_user_id: string }
        Returns: {
          access_state: string
          ai_reason: string
          batch_id: string
          business_date: string
          candidate_id: string
          candidate_snapshot: Json
          compatibility_label: string
          compatibility_score: number
          created_at: string
          decided_at: string
          feedback_note: string
          feedback_tags: string[]
          kind: string
          locked_count: number
          match_id: string
          match_status: Database["public"]["Enums"]["curated_match_status"]
          pair_key: string
          preview_id: string
          price_vnd: number
          product_mode: string
          suggested_opener: string
          user_id: string
        }[]
      }
      get_learning_course: { Args: { p_slug: string }; Returns: Json }
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
      get_match_candidates_v2: {
        Args: { p_cooldown_days?: number; p_limit?: number; p_user_id: string }
        Returns: {
          age: number
          age_pref_max: number
          age_pref_min: number
          ai_profile_analysis: Json
          appearance_preference: Json
          avatar_url: string
          bio: string
          campus: Database["public"]["Enums"]["campus"]
          candidate_to_preference: number
          coarse_score: number
          communication_similarity: number
          dating_goals: string[]
          dealbreakers: Json
          feedback_affinity: number
          gender: Database["public"]["Enums"]["gender"]
          height_cm: number
          id: string
          interests: string[]
          lifestyle_similarity: number
          looking_for_gender: string[]
          major: Database["public"]["Enums"]["major"]
          name: string
          need_similarity: number
          personality_tags: string[]
          preference_to_candidate: number
          preferred_vibes: string[]
          profile_completeness: number
          profile_text: Json
          self_similarity: number
        }[]
      }
      get_match_candidates_v2_without_avoidances: {
        Args: { p_cooldown_days?: number; p_limit?: number; p_user_id: string }
        Returns: {
          age: number
          age_pref_max: number
          age_pref_min: number
          ai_profile_analysis: Json
          appearance_preference: Json
          avatar_url: string
          bio: string
          campus: Database["public"]["Enums"]["campus"]
          candidate_to_preference: number
          coarse_score: number
          communication_similarity: number
          dating_goals: string[]
          dealbreakers: Json
          feedback_affinity: number
          gender: Database["public"]["Enums"]["gender"]
          height_cm: number
          id: string
          interests: string[]
          lifestyle_similarity: number
          looking_for_gender: string[]
          major: Database["public"]["Enums"]["major"]
          name: string
          need_similarity: number
          personality_tags: string[]
          preference_to_candidate: number
          preferred_vibes: string[]
          profile_completeness: number
          profile_text: Json
          self_similarity: number
        }[]
      }
      get_match_filter_metrics: {
        Args: { p_cooldown_days?: number; p_user_id: string }
        Returns: Json
      }
      get_preference_coach_context: {
        Args: { p_expected_user_id: string; p_limit?: number }
        Returns: {
          llm_eligible: boolean
          preference_summary: string
          profile_context: Json
          recent_turns: Json
          soft_avoidances: string[]
          soft_preferences: string[]
          user_age: number
        }[]
      }
      jsonb_array_or_empty: { Args: { p_value: Json }; Returns: Json }
      jsonb_object_or_empty: { Args: { p_value: Json }; Returns: Json }
      list_conversation_messages: {
        Args: { p_conversation_id: string; p_limit?: number }
        Returns: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_mine: boolean
          is_read: boolean
        }[]
      }
      list_conversation_summaries: {
        Args: { p_conversation_id?: string; p_limit?: number }
        Returns: {
          conversation_id: string
          is_anonymous: boolean
          last_message_content: string
          last_message_created_at: string
          last_message_is_mine: boolean
          partner_avatar_url: string
          partner_name: string
          unread_count: number
          updated_at: string
        }[]
      }
      list_learning_courses: {
        Args: never
        Returns: {
          completed_at: string
          course_id: string
          current_lesson: number
          description: string
          duration_minutes: number
          enrolled_at: string
          enrollment_status: string
          is_free: boolean
          lesson_count: number
          progress_percent: number
          slug: string
          subtitle: string
          title: string
        }[]
      }
      mark_ai_assistant_provider_started: {
        Args: {
          p_claim_token: string
          p_client_request_id: string
          p_expected_user_id: string
          p_request_fingerprint: string
          p_scope: string
        }
        Returns: boolean
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: {
          applied: boolean
          conversation_id: string
          marked_read_count: number
          unread_count: number
        }[]
      }
      mark_profile_embedding_processing: {
        Args: { p_profile_revision: number; p_user_id: string }
        Returns: boolean
      }
      match_pair_live_eligible: {
        Args: { p_candidate_id: string; p_user_id: string }
        Returns: boolean
      }
      normalize_profile_text_array: {
        Args: { p_max_items: number; p_max_length: number; p_values: string[] }
        Returns: string[]
      }
      pair_key_for: { Args: { a: string; b: string }; Returns: string }
      profile_hard_dealbreakers: {
        Args: { p_profile: Database["public"]["Tables"]["profiles"]["Row"] }
        Returns: string[]
      }
      profile_height_hard_compatible: {
        Args: {
          p_target: Database["public"]["Tables"]["profiles"]["Row"]
          p_viewer: Database["public"]["Tables"]["profiles"]["Row"]
        }
        Returns: boolean
      }
      profile_match_tokens: {
        Args: { p_profile: Database["public"]["Tables"]["profiles"]["Row"] }
        Returns: string[]
      }
      profile_matching_signals: {
        Args: { p_profile: Database["public"]["Tables"]["profiles"]["Row"] }
        Returns: Json
      }
      read_ai_jobs: {
        Args: { p_batch_size?: number; p_visibility_timeout?: number }
        Returns: {
          enqueued_at: string
          message: Json
          msg_id: number
          read_ct: number
          vt: string
        }[]
      }
      repair_daily_match_teaser: {
        Args: { p_batch_id: string }
        Returns: string
      }
      request_reveal_atomic: {
        Args: { p_expected_user_id?: string; p_session_id: string }
        Returns: {
          accepted: boolean
          is_revealed: boolean
          partner_id: string
          requested_by_me: boolean
          requested_by_partner: boolean
        }[]
      }
      request_reveal_atomic_internal: {
        Args: { p_session_id: string }
        Returns: {
          accepted: boolean
          is_revealed: boolean
          reveal_requests: Json
        }[]
      }
      save_onboarding_analysis: {
        Args: {
          p_analysis: Json
          p_analysis_source?: string
          p_draft_revision: number
          p_user_id: string
        }
        Returns: {
          analysis: Json
          analysis_revision: number
        }[]
      }
      save_onboarding_draft: {
        Args: {
          p_draft: Json
          p_expected_revision?: number
          p_expected_user_id?: string
          p_onboarding_version?: number
        }
        Returns: {
          analysis: Json | null
          analysis_revision: number | null
          analysis_source: string | null
          created_at: string
          draft: Json
          draft_revision: number
          onboarding_version: number
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "onboarding_drafts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      save_preference_chat_turn_atomic: {
        Args: {
          p_assistant_content: string
          p_content: string
          p_hints: string[]
          p_request_id: string
        }
        Returns: {
          applied: boolean
          assistant_message_id: string
          user_message_id: string
        }[]
      }
      send_message_atomic: {
        Args: {
          p_client_message_id: string
          p_content: string
          p_conversation_id: string
          p_expected_user_id?: string
        }
        Returns: {
          applied: boolean
          created_at: string
          message_id: string
        }[]
      }
      snapshot_match_tokens: { Args: { p_snapshot: Json }; Returns: string[] }
      submit_match_feedback_atomic: {
        Args: {
          p_decision: Database["public"]["Enums"]["feedback_decision"]
          p_idempotency_key: string
          p_match_id: string
          p_note?: string
          p_tags?: string[]
        }
        Returns: {
          applied: boolean
          conversation_id: string
          is_mutual: boolean
          match_id: string
          status: Database["public"]["Enums"]["curated_match_status"]
        }[]
      }
      submit_match_feedback_atomic_access_internal: {
        Args: {
          p_decision: Database["public"]["Enums"]["feedback_decision"]
          p_idempotency_key: string
          p_match_id: string
          p_note?: string
          p_tags?: string[]
        }
        Returns: {
          applied: boolean
          conversation_id: string
          is_mutual: boolean
          match_id: string
          status: Database["public"]["Enums"]["curated_match_status"]
        }[]
      }
      text_array_overlap_ratio: {
        Args: { p_left: string[]; p_right: string[] }
        Returns: number
      }
      unlock_daily_match_batch: {
        Args: {
          p_batch_id: string
          p_expected_user_id: string
          p_idempotency_key: string
        }
        Returns: {
          access_state: string
          applied: boolean
          batch_id: string
          price_vnd: number
          product_mode: string
          unlock_source: string
        }[]
      }
      vector_cosine_similarity: {
        Args: { p_left: string; p_right: string }
        Returns: number
      }
    }
    Enums: {
      ai_pick_batch_access_state: "teaser" | "locked" | "unlocked"
      ai_pick_product_mode: "open" | "stub"
      campus: "HCM" | "Hanoi" | "Danang" | "Cantho"
      curated_match_status:
        | "pending"
        | "accepted"
        | "declined"
        | "skipped"
        | "reported"
        | "matched"
      daily_match_batch_status: "generating" | "ready" | "empty" | "failed"
      embedding_job_status: "pending" | "processing" | "ready" | "failed"
      feedback_decision: "accepted" | "declined" | "skipped" | "reported"
      gender: "male" | "female" | "other" | "prefer_not_to_show"
      major: "SE" | "AI" | "Biz" | "Design" | "Marketing"
      match_enrichment_status:
        | "pending"
        | "processing"
        | "ready"
        | "failed"
        | "skipped"
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
      ai_pick_batch_access_state: ["teaser", "locked", "unlocked"],
      ai_pick_product_mode: ["open", "stub"],
      campus: ["HCM", "Hanoi", "Danang", "Cantho"],
      curated_match_status: [
        "pending",
        "accepted",
        "declined",
        "skipped",
        "reported",
        "matched",
      ],
      daily_match_batch_status: ["generating", "ready", "empty", "failed"],
      embedding_job_status: ["pending", "processing", "ready", "failed"],
      feedback_decision: ["accepted", "declined", "skipped", "reported"],
      gender: ["male", "female", "other", "prefer_not_to_show"],
      major: ["SE", "AI", "Biz", "Design", "Marketing"],
      match_enrichment_status: [
        "pending",
        "processing",
        "ready",
        "failed",
        "skipped",
      ],
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
