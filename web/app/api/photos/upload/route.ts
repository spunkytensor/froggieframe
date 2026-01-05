import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import convert from 'heic-convert';
import { createClient } from '@/lib/supabase/server';
import { processPhotoAnalysis } from '@/lib/ai/background-worker';
import { extractExifMetadata } from '@/lib/exif/extract-metadata';

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'image/gif',
]);

// Magic byte signatures for image validation
const IMAGE_SIGNATURES: Array<{ bytes: number[]; offset: number; mimeType: string }> = [
  { bytes: [0xFF, 0xD8, 0xFF], offset: 0, mimeType: 'image/jpeg' },
  { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0, mimeType: 'image/png' },
  { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0, mimeType: 'image/gif' },
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, mimeType: 'image/webp' }, // RIFF header for WebP
];

// HEIC/HEIF uses ftyp box - check for 'ftyp' at offset 4
function isHeicSignature(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const ftyp = buffer.slice(4, 8).toString('ascii');
  if (ftyp !== 'ftyp') return false;
  const brand = buffer.slice(8, 12).toString('ascii');
  return ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand);
}

function validateImageMagicBytes(buffer: Buffer): string | null {
  // Check HEIC/HEIF first (special case)
  if (isHeicSignature(buffer)) {
    return 'image/heic';
  }

  // Check other signatures
  for (const sig of IMAGE_SIGNATURES) {
    if (buffer.length < sig.offset + sig.bytes.length) continue;

    let matches = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[sig.offset + i] !== sig.bytes[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return sig.mimeType;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const streamId = formData.get('stream_id') as string | null;
    const filename = formData.get('filename') as string | null;

    if (!file || !streamId || !filename) {
      return NextResponse.json(
        { error: 'Missing required fields: file, stream_id, filename' },
        { status: 400 }
      );
    }

    // Validate file size before processing
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 400 }
      );
    }

    const { data: stream } = await supabase
      .from('photo_streams')
      .select('id')
      .eq('id', streamId)
      .eq('user_id', user.id)
      .single();

    if (!stream) {
      return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Validate file content using magic bytes
    const detectedMimeType = validateImageMagicBytes(inputBuffer);
    if (!detectedMimeType) {
      return NextResponse.json(
        { error: 'Invalid file type. File content does not match a supported image format.' },
        { status: 400 }
      );
    }

    // Verify detected type is in allowlist
    if (!ALLOWED_MIME_TYPES.has(detectedMimeType)) {
      return NextResponse.json(
        { error: `File type '${detectedMimeType}' is not allowed` },
        { status: 400 }
      );
    }

    // Extract EXIF metadata from original file before any conversion
    const exifData = await extractExifMetadata(inputBuffer);

    // Check if HEIC/HEIF using validated magic bytes - convert to high-quality JPEG
    const isHeic = detectedMimeType === 'image/heic' || detectedMimeType === 'image/heif';

    let outputBuffer: Buffer;
    let mimeType: string;
    let fileExt: string;

    if (isHeic) {
      // Convert HEIC to JPEG using heic-convert
      // The library internally needs a Uint8Array (despite types saying ArrayBufferLike)
      const converted = await convert({
        buffer: new Uint8Array(arrayBuffer) as unknown as ArrayBufferLike,
        format: 'JPEG',
        quality: 0.92,
      });
      outputBuffer = Buffer.from(converted);
      mimeType = 'image/jpeg';
      fileExt = 'jpg';
    } else {
      // Keep original file as-is, use validated mime type
      outputBuffer = inputBuffer;
      mimeType = detectedMimeType;
      // Map mime type to file extension
      const extMap: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
      };
      fileExt = extMap[detectedMimeType] || filename.split('.').pop()?.toLowerCase() || 'jpg';
    }

    const storagePath = `${user.id}/${streamId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('photos')
      .upload(storagePath, outputBuffer, {
        contentType: mimeType,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: photo, error: insertError } = await supabase
      .from('photos')
      .insert({
        stream_id: streamId,
        user_id: user.id,
        storage_path: storagePath,
        filename: filename,
        mime_type: mimeType,
        file_size: outputBuffer.length,
        ai_status: 'pending',
        exif_latitude: exifData.latitude,
        exif_longitude: exifData.longitude,
        exif_altitude: exifData.altitude,
        exif_captured_at: exifData.capturedAt?.toISOString() ?? null,
        exif_orientation: exifData.orientation,
      })
      .select()
      .single();

    if (insertError || !photo) {
      await supabase.storage.from('photos').remove([storagePath]);
      return NextResponse.json(
        { error: `Database error: ${insertError?.message}` },
        { status: 500 }
      );
    }

    // Generate signed URL with 10-minute expiry for AI analysis
    const { data: signedUrl } = await supabase.storage
      .from('photos')
      .createSignedUrl(storagePath, 600);

    if (signedUrl?.signedUrl) {
      waitUntil(processPhotoAnalysis(photo.id, user.id, signedUrl.signedUrl));
    }

    return NextResponse.json({
      id: photo.id,
      storage_path: photo.storage_path,
      ai_status: photo.ai_status,
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
