import { createServiceClient } from '@/lib/supabase/server';
import { analyzePhoto } from './analyze-photo';
import { extractExifFromUrl, type ExifMetadata } from '@/lib/exif/extract-metadata';
import type { PhotoAnalysis } from './schemas';
import type { Mood, TagCategory } from '@/types';

export function queuePhotoAnalysis(photoId: string, imageUrl: string): void {
  processPhotoAnalysis(photoId, imageUrl).catch((error) => {
    console.error(`Background AI analysis failed for photo ${photoId}:`, error);
  });
}

async function processPhotoAnalysis(photoId: string, imageUrl: string): Promise<void> {
  const supabase = createServiceClient();

  try {
    await supabase
      .from('photos')
      .update({ ai_status: 'processing' })
      .eq('id', photoId);

    // Extract EXIF metadata and run AI analysis in parallel
    const [exifData, analysis] = await Promise.all([
      extractExifFromUrl(imageUrl).catch((err) => {
        console.warn(`EXIF extraction failed for photo ${photoId}:`, err);
        return null;
      }),
      analyzePhoto(imageUrl),
    ]);

    await saveAnalysisResults(photoId, analysis, exifData);
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
  analysis: PhotoAnalysis,
  exifData: ExifMetadata | null
): Promise<void> {
  const supabase = createServiceClient();

  // First, check if EXIF data already exists (from browser extraction)
  const { data: existingPhoto } = await supabase
    .from('photos')
    .select('*')
    .eq('id', photoId)
    .single();

  // Only use server-extracted EXIF if browser didn't already save it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const photo = existingPhoto as Record<string, any> | null;
  const hasExistingExif = photo?.exif_latitude !== null || 
                          photo?.exif_captured_at !== null;

  const updateData: Record<string, unknown> = {
    mood: analysis.mood.value as Mood,
    mood_confidence: analysis.mood.confidence,
    ai_status: 'complete',
    ai_analyzed_at: new Date().toISOString(),
    ai_error: null,
  };

  // Only update EXIF fields if no existing data and we have new data
  if (!hasExistingExif && exifData) {
    updateData.exif_latitude = exifData.latitude;
    updateData.exif_longitude = exifData.longitude;
    updateData.exif_altitude = exifData.altitude;
    updateData.exif_captured_at = exifData.capturedAt?.toISOString() ?? null;
    updateData.exif_orientation = exifData.orientation;
  }

  await supabase
    .from('photos')
    .update(updateData)
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
