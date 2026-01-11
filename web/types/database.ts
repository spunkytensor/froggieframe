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
export type SourceType = 'stream' | 'google_photos' | 'direct_upload' | 'url_feed';
export type PlaylistType = 'all_sources' | 'favorites' | 'on_this_day' | 'people' | 'location' | 'recent' | 'mood' | 'custom';
export type Orientation = 'landscape' | 'portrait' | 'auto';
export type SyncFrequency = 'realtime' | 'hourly' | 'daily';
export type AspectRatioHandling = 'crop' | 'letterbox' | 'skip';

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
      frames: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          location: string | null;
          timezone: string;
          latitude: number | null;
          longitude: number | null;
          device_token_hash: string | null;
          brightness: number;
          orientation: Orientation;
          transition_effect: string;
          slideshow_interval: number;
          wake_time: string | null;
          sleep_time: string | null;
          is_online: boolean;
          last_seen_at: string | null;
          firmware_version: string | null;
          shuffle: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          location?: string | null;
          timezone?: string;
          latitude?: number | null;
          longitude?: number | null;
          device_token_hash?: string | null;
          brightness?: number;
          orientation?: Orientation;
          transition_effect?: string;
          slideshow_interval?: number;
          wake_time?: string | null;
          sleep_time?: string | null;
          is_online?: boolean;
          last_seen_at?: string | null;
          firmware_version?: string | null;
          shuffle?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          location?: string | null;
          timezone?: string;
          latitude?: number | null;
          longitude?: number | null;
          device_token_hash?: string | null;
          brightness?: number;
          orientation?: Orientation;
          transition_effect?: string;
          slideshow_interval?: number;
          wake_time?: string | null;
          sleep_time?: string | null;
          is_online?: boolean;
          last_seen_at?: string | null;
          firmware_version?: string | null;
          shuffle?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      frame_sources: {
        Row: {
          id: string;
          frame_id: string;
          source_type: SourceType;
          stream_id: string | null;
          external_config: Json | null;
          weight: number;
          is_enabled: boolean;
          sync_frequency: SyncFrequency;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          frame_id: string;
          source_type?: SourceType;
          stream_id?: string | null;
          external_config?: Json | null;
          weight?: number;
          is_enabled?: boolean;
          sync_frequency?: SyncFrequency;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          frame_id?: string;
          source_type?: SourceType;
          stream_id?: string | null;
          external_config?: Json | null;
          weight?: number;
          is_enabled?: boolean;
          sync_frequency?: SyncFrequency;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      frame_playlists: {
        Row: {
          id: string;
          frame_id: string;
          name: string;
          playlist_type: PlaylistType;
          config: Json;
          weight: number;
          is_active: boolean;
          schedule_start: string | null;
          schedule_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          frame_id: string;
          name: string;
          playlist_type?: PlaylistType;
          config?: Json;
          weight?: number;
          is_active?: boolean;
          schedule_start?: string | null;
          schedule_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          frame_id?: string;
          name?: string;
          playlist_type?: PlaylistType;
          config?: Json;
          weight?: number;
          is_active?: boolean;
          schedule_start?: string | null;
          schedule_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      frame_display_rules: {
        Row: {
          id: string;
          frame_id: string;
          exclude_screenshots: boolean;
          exclude_duplicates: boolean;
          min_quality_score: number;
          prefer_matching_orientation: boolean;
          aspect_ratio_handling: AspectRatioHandling;
          freshness_weight: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          frame_id: string;
          exclude_screenshots?: boolean;
          exclude_duplicates?: boolean;
          min_quality_score?: number;
          prefer_matching_orientation?: boolean;
          aspect_ratio_handling?: AspectRatioHandling;
          freshness_weight?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          frame_id?: string;
          exclude_screenshots?: boolean;
          exclude_duplicates?: boolean;
          min_quality_score?: number;
          prefer_matching_orientation?: boolean;
          aspect_ratio_handling?: AspectRatioHandling;
          freshness_weight?: number;
          created_at?: string;
          updated_at?: string;
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
