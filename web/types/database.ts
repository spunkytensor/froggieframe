export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TagCategory = 'person' | 'place' | 'object' | 'event';
export type Mood = 'calmer' | 'darker' | 'vibrant' | 'relaxing' | 'energetic' | 'neutral';
export type AIStatus = 'pending' | 'processing' | 'complete' | 'failed';

export interface Database {
  public: {
    Tables: {
      photo_tags: {
        Row: {
          id: string;
          photo_id: string;
          tag: string;
          category: TagCategory;
          confidence: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          photo_id: string;
          tag: string;
          category: TagCategory;
          confidence?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          photo_id?: string;
          tag?: string;
          category?: TagCategory;
          confidence?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      photo_streams: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          slideshow_interval: number;
          shuffle: boolean;
          transition_effect: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          slideshow_interval?: number;
          shuffle?: boolean;
          transition_effect?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          slideshow_interval?: number;
          shuffle?: boolean;
          transition_effect?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      photos: {
        Row: {
          id: string;
          stream_id: string;
          user_id: string;
          storage_path: string;
          filename: string;
          mime_type: string;
          file_size: number;
          width: number | null;
          height: number | null;
          thumbnail_path: string | null;
          sort_order: number;
          created_at: string;
          mood: Mood | null;
          mood_confidence: number | null;
          ai_status: AIStatus;
          ai_analyzed_at: string | null;
          ai_error: string | null;
        };
        Insert: {
          id?: string;
          stream_id: string;
          user_id: string;
          storage_path: string;
          filename: string;
          mime_type: string;
          file_size: number;
          width?: number | null;
          height?: number | null;
          thumbnail_path?: string | null;
          sort_order?: number;
          created_at?: string;
          mood?: Mood | null;
          mood_confidence?: number | null;
          ai_status?: AIStatus;
          ai_analyzed_at?: string | null;
          ai_error?: string | null;
        };
        Update: {
          id?: string;
          stream_id?: string;
          user_id?: string;
          storage_path?: string;
          filename?: string;
          mime_type?: string;
          file_size?: number;
          width?: number | null;
          height?: number | null;
          thumbnail_path?: string | null;
          sort_order?: number;
          created_at?: string;
          mood?: Mood | null;
          mood_confidence?: number | null;
          ai_status?: AIStatus;
          ai_analyzed_at?: string | null;
          ai_error?: string | null;
        };
        Relationships: [];
      };
      api_keys: {
        Row: {
          id: string;
          user_id: string;
          stream_id: string;
          key_hash: string;
          name: string;
          last_used_at: string | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stream_id: string;
          key_hash: string;
          name: string;
          last_used_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          stream_id?: string;
          key_hash?: string;
          name?: string;
          last_used_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      otp_secrets: {
        Row: {
          id: string;
          user_id: string;
          secret: string;
          is_enabled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          secret: string;
          is_enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          secret?: string;
          is_enabled?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          id: string;
          identifier: string;
          endpoint: string;
          attempt_count: number;
          window_start: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          identifier: string;
          endpoint: string;
          attempt_count?: number;
          window_start?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          identifier?: string;
          endpoint?: string;
          attempt_count?: number;
          window_start?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_rate_limit: {
        Args: {
          p_identifier: string;
          p_endpoint: string;
          p_max_attempts: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      cleanup_rate_limits: {
        Args: {
          p_older_than_seconds?: number;
        };
        Returns: number;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
