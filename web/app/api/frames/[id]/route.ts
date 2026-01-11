import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isValidUUID } from '@/lib/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid frame ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: frame, error } = await supabase
      .from('frames')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !frame) {
      return NextResponse.json({ error: 'Frame not found' }, { status: 404 });
    }

    const [sourcesResult, playlistsResult, rulesResult] = await Promise.all([
      supabase
        .from('frame_sources')
        .select('*, stream:photo_streams(*)')
        .eq('frame_id', id),
      supabase
        .from('frame_playlists')
        .select('*')
        .eq('frame_id', id)
        .order('created_at'),
      supabase
        .from('frame_display_rules')
        .select('*')
        .eq('frame_id', id)
        .single(),
    ]);

    return NextResponse.json({
      frame: {
        ...frame,
        sources: sourcesResult.data || [],
        playlists: playlistsResult.data || [],
        display_rules: rulesResult.data || null,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch frame' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid frame ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const allowedFields = [
      'name', 'location', 'timezone', 'latitude', 'longitude',
      'brightness', 'orientation', 'transition_effect', 'slideshow_interval',
      'wake_time', 'sleep_time', 'shuffle'
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: frame, error } = await supabase
      .from('frames')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!frame) {
      return NextResponse.json({ error: 'Frame not found' }, { status: 404 });
    }

    return NextResponse.json({ frame });
  } catch {
    return NextResponse.json({ error: 'Failed to update frame' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid frame ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
      .from('frames')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete frame' }, { status: 500 });
  }
}
