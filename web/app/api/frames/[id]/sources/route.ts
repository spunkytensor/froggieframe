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

    const { data: sources, error } = await supabase
      .from('frame_sources')
      .select('*, stream:photo_streams(*)')
      .eq('frame_id', id)
      .order('created_at');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sources });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 });
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
    const { source_type, stream_id, external_config, weight, sync_frequency } = body;

    if (source_type === 'stream' && stream_id) {
      const { data: existingSource } = await supabase
        .from('frame_sources')
        .select('id')
        .eq('frame_id', id)
        .eq('stream_id', stream_id)
        .single();

      if (existingSource) {
        return NextResponse.json({ error: 'Stream already added to this frame' }, { status: 400 });
      }

      const { data: stream } = await supabase
        .from('photo_streams')
        .select('id')
        .eq('id', stream_id)
        .eq('user_id', user.id)
        .single();

      if (!stream) {
        return NextResponse.json({ error: 'Stream not found' }, { status: 404 });
      }
    }

    const { data: source, error } = await supabase
      .from('frame_sources')
      .insert({
        frame_id: id,
        source_type: source_type || 'stream',
        stream_id: stream_id || null,
        external_config: external_config || null,
        weight: weight ?? 100,
        sync_frequency: sync_frequency || 'realtime',
      })
      .select('*, stream:photo_streams(*)')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ source }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to add source' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('source_id');
    
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid frame ID' }, { status: 400 });
    }

    if (!sourceId || !isValidUUID(sourceId)) {
      return NextResponse.json({ error: 'Invalid source ID' }, { status: 400 });
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
      .from('frame_sources')
      .delete()
      .eq('id', sourceId)
      .eq('frame_id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete source' }, { status: 500 });
  }
}
