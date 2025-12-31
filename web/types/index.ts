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
