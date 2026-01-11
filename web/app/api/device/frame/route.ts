import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { hashApiKey } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const deviceToken = request.headers.get('X-Device-Token');

    if (!deviceToken) {
      return NextResponse.json(
        { error: 'Device token required' },
        { status: 401 }
      );
    }

    const supabase = createServiceClient();

    const tokenHash = await hashApiKey(deviceToken);
    const { data: frame, error } = await supabase
      .from('frames')
      .select('*')
      .eq('device_token_hash', tokenHash)
      .single();

    if (error || !frame) {
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

    const [sourcesResult, playlistsResult, rulesResult] = await Promise.all([
      supabase
        .from('frame_sources')
        .select('*, stream:photo_streams(*)')
        .eq('frame_id', frame.id)
        .eq('is_enabled', true),
      supabase
        .from('frame_playlists')
        .select('*')
        .eq('frame_id', frame.id)
        .eq('is_active', true),
      supabase
        .from('frame_display_rules')
        .select('*')
        .eq('frame_id', frame.id)
        .single(),
    ]);

    return NextResponse.json({
      frame: {
        id: frame.id,
        name: frame.name,
        brightness: frame.brightness,
        orientation: frame.orientation,
        transition_effect: frame.transition_effect,
        slideshow_interval: frame.slideshow_interval,
        wake_time: frame.wake_time,
        sleep_time: frame.sleep_time,
        shuffle: frame.shuffle,
      },
      sources: sourcesResult.data || [],
      playlists: playlistsResult.data || [],
      display_rules: rulesResult.data || null,
    });
  } catch (error) {
    console.error('Device frame error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch frame config' },
      { status: 500 }
    );
  }
}
