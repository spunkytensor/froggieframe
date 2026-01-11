export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface PhotoStream {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  slideshow_interval: number;
  shuffle: boolean;
  transition_effect: string;
  created_at: string;
  updated_at: string;
}

export type TagCategory = 'person' | 'place' | 'object' | 'event';
export type Mood = 'calmer' | 'darker' | 'vibrant' | 'relaxing' | 'energetic' | 'neutral';
export type AIStatus = 'pending' | 'processing' | 'complete' | 'failed';

export interface Photo {
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
  exif_latitude: number | null;
  exif_longitude: number | null;
  exif_altitude: number | null;
  exif_captured_at: string | null;
  exif_orientation: number | null;
}

export interface PhotoTag {
  id: string;
  photo_id: string;
  tag: string;
  category: TagCategory;
  confidence: number | null;
  created_at: string;
}

export interface PhotoWithTags extends Photo {
  tags: PhotoTag[];
}

export interface ApiKey {
  id: string;
  user_id: string;
  stream_id: string;
  key_hash: string;
  name: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface OtpSecret {
  id: string;
  user_id: string;
  is_enabled: boolean;
  created_at: string;
}

export interface DevicePhotoResponse {
  photos: {
    id: string;
    storage_path: string;
    filename: string;
    download_url: string;
  }[];
  count: number;
}

export interface ApiError {
  error: string;
  message: string;
}

export type SourceType = 'stream' | 'google_photos' | 'direct_upload' | 'url_feed';
export type PlaylistType = 'all_sources' | 'favorites' | 'on_this_day' | 'people' | 'location' | 'recent' | 'mood' | 'custom';
export type Orientation = 'landscape' | 'portrait' | 'auto';
export type SyncFrequency = 'realtime' | 'hourly' | 'daily';
export type AspectRatioHandling = 'crop' | 'letterbox' | 'skip';

export interface Frame {
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
}

export interface FrameSource {
  id: string;
  frame_id: string;
  source_type: SourceType;
  stream_id: string | null;
  external_config: Record<string, unknown> | null;
  weight: number;
  is_enabled: boolean;
  sync_frequency: SyncFrequency;
  created_at: string;
  updated_at: string;
}

export interface FrameSourceWithStream extends FrameSource {
  stream?: PhotoStream;
}

export interface FramePlaylist {
  id: string;
  frame_id: string;
  name: string;
  playlist_type: PlaylistType;
  config: Record<string, unknown>;
  weight: number;
  is_active: boolean;
  schedule_start: string | null;
  schedule_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface FrameDisplayRules {
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
}

export interface FrameWithDetails extends Frame {
  sources: FrameSourceWithStream[];
  playlists: FramePlaylist[];
  display_rules: FrameDisplayRules | null;
}
