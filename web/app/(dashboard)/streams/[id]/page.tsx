'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { formatBytes } from '@/lib/utils';
import { Upload, Trash2, RefreshCw, Info } from 'lucide-react';
import type { PhotoStream, Photo, PhotoTag } from '@/types';
import { TagBadge, MoodIndicator, AIStatusBadge } from '@/components/ai';
import { PhotoInfoModal } from '@/components/photo';

export default function StreamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const streamId = params.id as string;

  const [stream, setStream] = React.useState<PhotoStream | null>(null);
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [photoUrls, setPhotoUrls] = React.useState<Record<string, string>>({});
  const [photoTags, setPhotoTags] = React.useState<Record<string, PhotoTag[]>>({});
  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [reanalyzing, setReanalyzing] = React.useState<string | null>(null);
  const [infoPhoto, setInfoPhoto] = React.useState<Photo | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!user) return;

    const supabase = createClient();

    const { data: streamData } = await supabase
      .from('photo_streams')
      .select('*')
      .eq('id', streamId)
      .single();
    
    const { data: photosData } = await supabase
      .from('photos')
      .select('*')
      .eq('stream_id', streamId)
      .order('sort_order');

    if (streamData) {
      setStream(streamData as PhotoStream);
    }
    const photosArray = (photosData || []) as Photo[];
    setPhotos(photosArray);

    if (photosArray.length > 0) {
      const { data: tagsData } = await supabase
        .from('photo_tags')
        .select('*')
        .in('photo_id', photosArray.map(p => p.id));

      const tagsByPhoto: Record<string, PhotoTag[]> = {};
      (tagsData || []).forEach((tag) => {
        if (!tagsByPhoto[tag.photo_id]) tagsByPhoto[tag.photo_id] = [];
        tagsByPhoto[tag.photo_id].push(tag as PhotoTag);
      });
      setPhotoTags(tagsByPhoto);
    }

    // Generate signed URLs for all photos
    if (photosArray.length > 0) {
      const paths = photosArray.map(p => p.storage_path);
      // Generate signed URLs with 10-minute expiry for security
      const { data: signedUrlsData } = await supabase.storage
        .from('photos')
        .createSignedUrls(paths, 600);

      if (signedUrlsData) {
        const urlMap: Record<string, string> = {};
        signedUrlsData.forEach((item, index) => {
          if (item.signedUrl) {
            urlMap[photosArray[index].id] = item.signedUrl;
          }
        });
        setPhotoUrls(urlMap);
      }
    }

    setLoading(false);
  }, [user, streamId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscribe to realtime updates for photo AI status changes
  React.useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase
      .channel(`photos-${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'photos',
          filter: `stream_id=eq.${streamId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, fetchData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError('');

    const supabase = createClient();

    for (const file of Array.from(files)) {
      const isHeic = file.type === 'image/heic' || 
                     file.type === 'image/heif' || 
                     file.name.toLowerCase().endsWith('.heic') ||
                     file.name.toLowerCase().endsWith('.heif');

      if (!file.type.startsWith('image/') && !isHeic) {
        setError('Only image files are allowed');
        continue;
      }

      if (file.size > 200 * 1024 * 1024) {
        setError('File size must be less than 200MB');
        continue;
      }

      // Upload via API route (handles HEIC→JPEG conversion and EXIF extraction server-side)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('stream_id', streamId);
      formData.append('filename', file.name);

      const uploadResponse = await fetch('/api/photos/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        setError(`Upload failed: ${errorData.error}`);
        continue;
      }

      const uploadResult = await uploadResponse.json();
      console.log('[Upload] Photo uploaded successfully:', uploadResult.id);
    }

    await fetchData();
    setUploading(false);
    e.target.value = '';
  };

  const handleDeletePhoto = async (photoId: string, storagePath: string) => {
    if (!confirm('Delete this photo?')) return;

    const supabase = createClient();
    await supabase.storage.from('photos').remove([storagePath]);
    await supabase.from('photos').delete().eq('id', photoId);
    setPhotos(photos.filter(p => p.id !== photoId));
  };

  const handleReanalyze = async (photoId: string) => {
    setReanalyzing(photoId);
    try {
      const response = await fetch(`/api/photos/${photoId}/analyze`, {
        method: 'POST',
      });
      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Reanalyze error:', error);
    } finally {
      setReanalyzing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Stream not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{stream.name}</h1>
          <p className="text-muted-foreground">
            {stream.description || 'No description'}
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Photos Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Photos</CardTitle>
              <CardDescription>{photos.length} photos in this stream</CardDescription>
            </div>
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
              <Button disabled={uploading} className="pointer-events-none">
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload Photos'}
              </Button>
            </label>
          </div>
        </CardHeader>
        <CardContent>
          {photos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No photos yet. Upload some to get started!
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="group">
                  <div className="aspect-square relative">
                    {photoUrls[photo.id] ? (
                      <img
                        src={photoUrls[photo.id]}
                        alt={photo.filename}
                        className="w-full h-full object-cover rounded-t-lg"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted rounded-t-lg flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-lg flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleReanalyze(photo.id)}
                        disabled={reanalyzing === photo.id}
                        className="p-2 bg-secondary text-secondary-foreground rounded-full"
                        title="Reanalyze with AI"
                      >
                        <RefreshCw className={`h-4 w-4 ${reanalyzing === photo.id ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleDeletePhoto(photo.id, photo.storage_path)}
                        className="p-2 bg-destructive text-destructive-foreground rounded-full"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-2 bg-muted rounded-b-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">{formatBytes(photo.file_size)}</p>
                      <button
                        onClick={() => setInfoPhoto(photo)}
                        className="p-1 hover:bg-background rounded-full transition-colors"
                        title="Photo info"
                      >
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                    {photo.ai_status === 'complete' ? (
                      <>
                        {photo.mood && (
                          <MoodIndicator mood={photo.mood} size="sm" />
                        )}
                        {(photoTags[photo.id] || []).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {(photoTags[photo.id] || []).slice(0, 4).map((tag) => (
                              <TagBadge
                                key={tag.id}
                                tag={tag.tag}
                                category={tag.category}
                                size="sm"
                              />
                            ))}
                            {(photoTags[photo.id] || []).length > 4 && (
                              <span className="text-xs text-muted-foreground">
                                +{(photoTags[photo.id] || []).length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <AIStatusBadge
                        status={photo.ai_status}
                        error={photo.ai_error}
                        onRetry={() => handleReanalyze(photo.id)}
                        size="sm"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {infoPhoto && (
        <PhotoInfoModal
          photo={infoPhoto}
          onClose={() => setInfoPhoto(null)}
        />
      )}
    </div>
  );
}
