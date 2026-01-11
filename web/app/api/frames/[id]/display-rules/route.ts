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

    const { data: rules, error } = await supabase
      .from('frame_display_rules')
      .select('*')
      .eq('frame_id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rules: rules || null });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch display rules' }, { status: 500 });
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
    const allowedFields = [
      'exclude_screenshots',
      'exclude_duplicates',
      'min_quality_score',
      'prefer_matching_orientation',
      'aspect_ratio_handling',
      'freshness_weight',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    const { data: existingRules } = await supabase
      .from('frame_display_rules')
      .select('id')
      .eq('frame_id', id)
      .single();

    let rules;
    if (existingRules) {
      const { data, error } = await supabase
        .from('frame_display_rules')
        .update(updates)
        .eq('frame_id', id)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      rules = data;
    } else {
      const { data, error } = await supabase
        .from('frame_display_rules')
        .insert({ frame_id: id, ...updates })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      rules = data;
    }

    return NextResponse.json({ rules });
  } catch {
    return NextResponse.json({ error: 'Failed to update display rules' }, { status: 500 });
  }
}
