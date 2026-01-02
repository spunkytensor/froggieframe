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
