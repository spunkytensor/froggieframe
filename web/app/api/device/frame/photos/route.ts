import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { hashApiKey } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const deviceToken = request.headers.get('X-Device-Token');
    const countOnly = request.nextUrl.searchParams.get('count_only') === 'true';

    if (!deviceToken) {
      return NextResponse.json(
        { error: 'Device token required' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();

    const tokenHash = await hashApiKey(deviceToken);
    const { data: frame, error: frameError } = await supabase
      .from('frames')
      .select('id, user_id, orientation, shuffle')
      .eq('device_token_hash', tokenHash)
      .single();

    if (frameError || !frame) {
      return NextResponse.json(
        { error: 'Invalid device token' },
        { status: 401 }
      );
    }

    await supabase
      .from('frames')
      .update({ 
        is_online: true, 
        last_seen_at: new Date().toISOString() 
      })
      .eq('id', frame.id);

    const { data: sources } = await supabase
      .from('frame_sources')
      .select('stream_id, weight')
      .eq('frame_id', frame.id)
      .eq('is_enabled', true)
      .not('stream_id', 'is', null);

    if (!sources || sources.length === 0) {
      return NextResponse.json({ photos: [], count: 0 });
    }

    const streamIds = sources.map(s => s.stream_id).filter((id): id is string => id !== null);

    if (countOnly) {
      const { count } = await supabase
        .from('photos')
        .select('*', { count: 'exact', head: true })
        .in('stream_id', streamIds);

      return NextResponse.json({ count });
    }

    const { data: rulesData } = await supabase
      .from('frame_display_rules')
      .select('*')
      .eq('frame_id', frame.id)
      .single();

    const rules = rulesData || {
      prefer_matching_orientation: true,
      min_quality_score: 0,
      freshness_weight: 50,
    };

    const { data: photos } = await supabase
      .from('photos')
      .select('id, storage_path, filename, mood, mood_confidence, ai_status, width, height, created_at, stream_id')
      .in('stream_id', streamIds)
      .order('created_at', { ascending: false });

    if (!photos || photos.length === 0) {
      return NextResponse.json({ photos: [], count: 0 });
    }

    let filteredPhotos = photos;

    if (rules.prefer_matching_orientation && frame.orientation !== 'auto') {
      const isLandscapeFrame = frame.orientation === 'landscape';
      filteredPhotos = photos.filter(p => {
        if (!p.width || !p.height) return true;
        const isLandscapePhoto = p.width > p.height;
        return isLandscapePhoto === isLandscapeFrame;
      });
      if (filteredPhotos.length === 0) {
        filteredPhotos = photos;
      }
    }

    const streamWeights = new Map(sources.map(s => [s.stream_id, s.weight || 100]));
    filteredPhotos = filteredPhotos.map(p => ({
      ...p,
      _weight: streamWeights.get(p.stream_id) || 100,
    }));

    const { data: allTags } = await supabase
      .from('photo_tags')
      .select('photo_id, tag, category, confidence')
      .in('photo_id', filteredPhotos.map(p => p.id));

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
      filteredPhotos.map(async (photo) => {
        const { data: signedUrl } = await supabase.storage
          .from('photos')
          .createSignedUrl(photo.storage_path, 600);

        return {
          id: photo.id,
          storage_path: photo.storage_path,
          filename: photo.filename,
          download_url: signedUrl?.signedUrl || '',
          mood: photo.mood,
          mood_confidence: photo.mood_confidence,
          ai_status: photo.ai_status,
          tags: tagsByPhoto[photo.id] || [],
          weight: (photo as typeof photo & { _weight: number })._weight,
        };
      })
    );

    return NextResponse.json({
      photos: photosWithUrls,
      count: photosWithUrls.length,
      frame: {
        id: frame.id,
        shuffle: frame.shuffle,
      },
    });
  } catch (error) {
    console.error('Device frame photos error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch photos' },
      { status: 500 }
    );
  }
}
