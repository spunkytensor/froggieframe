import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateApiKey, hashApiKey, isValidUUID } from '@/lib/utils';

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

    const deviceToken = generateApiKey();
    const deviceTokenHash = await hashApiKey(deviceToken);

    const { error } = await supabase
      .from('frames')
      .update({ device_token_hash: deviceTokenHash })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ device_token: deviceToken });
  } catch {
    return NextResponse.json({ error: 'Failed to regenerate token' }, { status: 500 });
  }
}
