import { createServiceClient } from '@/lib/supabase/server';
import { analyzePhoto } from './analyze-photo';
import type { PhotoAnalysis } from './schemas';
import type { Mood, TagCategory } from '@/types';

export function queuePhotoAnalysis(photoId: string, userId: string, imageUrl: string): void {
  processPhotoAnalysis(photoId, userId, imageUrl).catch((error) => {
    console.error(`Background AI analysis failed for photo ${photoId}:`, error);
  });
}

export async function processPhotoAnalysis(photoId: string, userId: string, imageUrl: string): Promise<void> {
  const supabase = createServiceClient();

  try {
    // Validate ownership before updating - even with service role
    const { data: photo, error: verifyError } = await supabase
      .from('photos')
      .select('id')
      .eq('id', photoId)
      .eq('user_id', userId)
      .single();

    if (verifyError || !photo) {
      throw new Error(`Ownership validation failed for photo ${photoId}`);
    }

    await supabase
      .from('photos')
      .update({ ai_status: 'processing' })
      .eq('id', photoId)
      .eq('user_id', userId);

    const analysis = await analyzePhoto(imageUrl);
    await saveAnalysisResults(photoId, userId, analysis);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`AI analysis failed for photo ${photoId}:`, errorMessage);

    await supabase
      .from('photos')
      .update({
        ai_status: 'failed',
        ai_error: errorMessage,
      })
      .eq('id', photoId)
      .eq('user_id', userId);
  }
}

async function saveAnalysisResults(
  photoId: string,
  userId: string,
  analysis: PhotoAnalysis
): Promise<void> {
  const supabase = createServiceClient();

  await supabase
    .from('photos')
    .update({
      mood: analysis.mood.value as Mood,
      mood_confidence: analysis.mood.confidence,
      ai_status: 'complete',
      ai_analyzed_at: new Date().toISOString(),
      ai_error: null,
    })
    .eq('id', photoId)
    .eq('user_id', userId);

  if (analysis.tags.length > 0) {
    // Verify ownership before inserting tags
    const { data: photo } = await supabase
      .from('photos')
      .select('id')
      .eq('id', photoId)
      .eq('user_id', userId)
      .single();

    if (photo) {
      const tagRecords = analysis.tags.map((t) => ({
        photo_id: photoId,
        tag: t.tag.toLowerCase(),
        category: t.category as TagCategory,
        confidence: t.confidence,
      }));

      await supabase.from('photo_tags').insert(tagRecords);
    }
  }
}

export async function analyzeNewPhoto(photoId: string, userId: string): Promise<void> {
  const supabase = createServiceClient();

  // Validate ownership when fetching photo
  const { data: photo, error } = await supabase
    .from('photos')
    .select('id, storage_path, ai_status')
    .eq('id', photoId)
    .eq('user_id', userId)
    .single();

  if (error || !photo) {
    throw new Error(`Photo not found or access denied: ${photoId}`);
  }

  // Generate signed URL with 10-minute expiry for security
  const { data: signedUrl } = await supabase.storage
    .from('photos')
    .createSignedUrl(photo.storage_path, 600);

  if (!signedUrl?.signedUrl) {
    throw new Error('Failed to generate signed URL for photo');
  }

  queuePhotoAnalysis(photoId, userId, signedUrl.signedUrl);
}

export async function reanalyzePhoto(photoId: string, userId: string): Promise<void> {
  const supabase = createServiceClient();

  // Validate ownership when fetching photo
  const { data: photo, error } = await supabase
    .from('photos')
    .select('id, storage_path')
    .eq('id', photoId)
    .eq('user_id', userId)
    .single();

  if (error || !photo) {
    throw new Error(`Photo not found or access denied: ${photoId}`);
  }

  await supabase.from('photo_tags').delete().eq('photo_id', photoId);

  await supabase
    .from('photos')
    .update({
      ai_status: 'pending',
      ai_error: null,
      mood: null,
      mood_confidence: null,
      ai_analyzed_at: null,
      exif_latitude: null,
      exif_longitude: null,
      exif_altitude: null,
      exif_captured_at: null,
      exif_orientation: null,
    })
    .eq('id', photoId)
    .eq('user_id', userId);

  // Generate signed URL with 10-minute expiry for security
  const { data: signedUrl } = await supabase.storage
    .from('photos')
    .createSignedUrl(photo.storage_path, 600);

  if (!signedUrl?.signedUrl) {
    throw new Error('Failed to generate signed URL for photo');
  }

  queuePhotoAnalysis(photoId, userId, signedUrl.signedUrl);
}
