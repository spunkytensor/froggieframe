import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { hashApiKey } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-API-Key');
    const streamId = request.nextUrl.searchParams.get('stream_id');
    const countOnly = request.nextUrl.searchParams.get('count_only') === 'true';

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    if (!streamId) {
      return NextResponse.json(
        { error: 'Stream ID required' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Verify API key (including expiry check)
    const keyHash = await hashApiKey(apiKey);
    const now = new Date().toISOString();
    const { data: apiKeyData } = await supabase
      .from('api_keys')
      .select('id, stream_id')
      .eq('key_hash', keyHash)
      .eq('stream_id', streamId)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .single();

    if (!apiKeyData) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    // Update last used
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyData.id);

    // Get photos
    if (countOnly) {
      const { count } = await supabase
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .eq('stream_id', streamId);

      return NextResponse.json({ count });
    }

    const { data: photos } = await supabase
      .from('photos')
      .select('id, storage_path, filename, mood, mood_confidence, ai_status')
      .eq('stream_id', streamId)
      .order('sort_order');

    const { data: allTags } = await supabase
      .from('photo_tags')
      .select('photo_id, tag, category, confidence')
      .in('photo_id', (photos || []).map(p => p.id));

    const tagsByPhoto = (allTags || []).reduce((acc, tag) => {
      if (!acc[tag.photo_id]) acc[tag.photo_id] = [];
      acc[tag.photo_id].push({
        tag: tag.tag,
        category: tag.category,
        confidence: tag.confidence,
      });
      return acc;
    }, {} as Record<string, Array<{ tag: string; category: string; confidence: number | null }>>);

    const photosWithUrls = await Promise.all(
      (photos || []).map(async (photo) => {
        const { data: signedUrl } = await supabase.storage
          .from('photos')
          .createSignedUrl(photo.storage_path, 3600);

        return {
          id: photo.id,
          storage_path: photo.storage_path,
          filename: photo.filename,
          download_url: signedUrl?.signedUrl || '',
          mood: photo.mood,
          mood_confidence: photo.mood_confidence,
          ai_status: photo.ai_status,
          tags: tagsByPhoto[photo.id] || [],
        };
      })
    );

    return NextResponse.json({
      photos: photosWithUrls,
      count: photosWithUrls.length,
    });
  } catch (error) {
    console.error('Device photos error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    );
  }
}
