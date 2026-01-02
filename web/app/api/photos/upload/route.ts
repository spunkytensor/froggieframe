import { NextRequest, NextResponse } from 'next/server';
import convert from 'heic-convert';
import { createClient } from '@/lib/supabase/server';
import { queuePhotoAnalysis } from '@/lib/ai/background-worker';
import { extractExifMetadata } from '@/lib/exif/extract-metadata';

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
    
    // Extract EXIF metadata from original file before any conversion
    const exifData = await extractExifMetadata(inputBuffer);
    
    // Check if HEIC/HEIF - convert to high-quality JPEG
    const isHeic = file.type === 'image/heic' || 
                   file.type === 'image/heif' ||
                   filename.toLowerCase().endsWith('.heic') ||
                   filename.toLowerCase().endsWith('.heif');

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
      // Keep original file as-is
      outputBuffer = inputBuffer;
      mimeType = file.type || 'image/jpeg';
      fileExt = filename.split('.').pop()?.toLowerCase() || 'jpg';
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

    const { data: signedUrl } = await supabase.storage
      .from('photos')
      .createSignedUrl(storagePath, 3600);

    if (signedUrl?.signedUrl) {
      queuePhotoAnalysis(photo.id, signedUrl.signedUrl);
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
