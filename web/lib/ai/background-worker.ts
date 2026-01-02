import { createServiceClient } from '@/lib/supabase/server';
import { analyzePhoto } from './analyze-photo';
import type { PhotoAnalysis } from './schemas';
import type { Mood, TagCategory } from '@/types';

export function queuePhotoAnalysis(photoId: string, imageUrl: string): void {
  processPhotoAnalysis(photoId, imageUrl).catch((error) => {
    console.error(`Background AI analysis failed for photo ${photoId}:`, error);
  });
}

export async function processPhotoAnalysis(photoId: string, imageUrl: string): Promise<void> {
  const supabase = createServiceClient();

  try {
    await supabase
      .from('photos')
      .update({ ai_status: 'processing' })
      .eq('id', photoId);

    const analysis = await analyzePhoto(imageUrl);
    await saveAnalysisResults(photoId, analysis);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`AI analysis failed for photo ${photoId}:`, errorMessage);

    await supabase
      .from('photos')
      .update({
        ai_status: 'failed',
        ai_error: errorMessage,
      })
      .eq('id', photoId);
  }
}

async function saveAnalysisResults(
  photoId: string,
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
    .eq('id', photoId);

  if (analysis.tags.length > 0) {
    const tagRecords = analysis.tags.map((t) => ({
      photo_id: photoId,
      tag: t.tag.toLowerCase(),
      category: t.category as TagCategory,
      confidence: t.confidence,
    }));

    await supabase.from('photo_tags').insert(tagRecords);
  }
}

export async function analyzeNewPhoto(photoId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: photo, error } = await supabase
    .from('photos')
    .select('id, storage_path, ai_status')
    .eq('id', photoId)
    .single();

  if (error || !photo) {
    throw new Error(`Photo not found: ${photoId}`);
  }

  const { data: signedUrl } = await supabase.storage
    .from('photos')
    .createSignedUrl(photo.storage_path, 3600);

  if (!signedUrl?.signedUrl) {
    throw new Error('Failed to generate signed URL for photo');
  }

  queuePhotoAnalysis(photoId, signedUrl.signedUrl);
}

export async function reanalyzePhoto(photoId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: photo, error } = await supabase
    .from('photos')
    .select('id, storage_path')
    .eq('id', photoId)
    .single();

  if (error || !photo) {
    throw new Error(`Photo not found: ${photoId}`);
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
    .eq('id', photoId);

  const { data: signedUrl } = await supabase.storage
    .from('photos')
    .createSignedUrl(photo.storage_path, 3600);

  if (!signedUrl?.signedUrl) {
    throw new Error('Failed to generate signed URL for photo');
  }

  queuePhotoAnalysis(photoId, signedUrl.signedUrl);
}
