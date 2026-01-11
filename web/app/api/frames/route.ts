import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateApiKey, hashApiKey } from '@/lib/utils';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: frames, error } = await supabase
      .from('frames')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ frames });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch frames' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, location, timezone, latitude, longitude } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const deviceToken = generateApiKey();
    const deviceTokenHash = await hashApiKey(deviceToken);

    const { data: frame, error } = await supabase
      .from('frames')
      .insert({
        user_id: user.id,
        name: name.trim(),
        location: location || null,
        timezone: timezone || 'UTC',
        latitude: latitude || null,
        longitude: longitude || null,
        device_token_hash: deviceTokenHash,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { error: rulesError } = await supabase
      .from('frame_display_rules')
      .insert({ frame_id: frame.id });

    if (rulesError) {
      console.error('Failed to create default display rules:', rulesError);
    }

    return NextResponse.json({ 
      frame,
      device_token: deviceToken,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create frame' }, { status: 500 });
  }
}
