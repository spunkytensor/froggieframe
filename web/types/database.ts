export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
