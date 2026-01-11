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

    const { data: frame } = await supabase
      .from('frames')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!frame) {
      return NextResponse.json({ error: 'Frame not found' }, { status: 404 });
    }

    const { data: playlists, error } = await supabase
      .from('frame_playlists')
      .select('*')
      .eq('frame_id', id)
      .order('created_at');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ playlists });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch playlists' }, { status: 500 });
  }
}

export async function POST(
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

    const { data: frame } = await supabase
      .from('frames')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!frame) {
      return NextResponse.json({ error: 'Frame not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, playlist_type, config, weight, schedule_start, schedule_end } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const { data: playlist, error } = await supabase
      .from('frame_playlists')
      .insert({
        frame_id: id,
        name: name.trim(),
        playlist_type: playlist_type || 'all_sources',
        config: config || {},
        weight: weight ?? 100,
        schedule_start: schedule_start || null,
        schedule_end: schedule_end || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ playlist }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create playlist' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const playlistId = searchParams.get('playlist_id');
    
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid frame ID' }, { status: 400 });
    }

    if (!playlistId || !isValidUUID(playlistId)) {
      return NextResponse.json({ error: 'Invalid playlist ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: frame } = await supabase
      .from('frames')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!frame) {
      return NextResponse.json({ error: 'Frame not found' }, { status: 404 });
    }

    const body = await request.json();
    const allowedFields = ['name', 'playlist_type', 'config', 'weight', 'is_active', 'schedule_start', 'schedule_end'];
    
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: playlist, error } = await supabase
      .from('frame_playlists')
      .update(updates)
      .eq('id', playlistId)
      .eq('frame_id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ playlist });
  } catch {
    return NextResponse.json({ error: 'Failed to update playlist' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const playlistId = searchParams.get('playlist_id');
    
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid frame ID' }, { status: 400 });
    }

    if (!playlistId || !isValidUUID(playlistId)) {
      return NextResponse.json({ error: 'Invalid playlist ID' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: frame } = await supabase
      .from('frames')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (!frame) {
      return NextResponse.json({ error: 'Frame not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('frame_playlists')
      .delete()
      .eq('id', playlistId)
      .eq('frame_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete playlist' }, { status: 500 });
  }
}
