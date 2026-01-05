import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeNewPhoto, reanalyzePhoto } from '@/lib/ai/background-worker';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: photoId } = await params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: photo } = await supabase
      .from('photos')
      .select('id, user_id, ai_status')
      .eq('id', photoId)
      .single();

    if (!photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    if (photo.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Use analyzeNewPhoto for pending photos, reanalyzePhoto for completed/failed
    if (photo.ai_status === 'pending') {
      await analyzeNewPhoto(photoId, user.id);
    } else {
      await reanalyzePhoto(photoId, user.id);
    }

    return NextResponse.json(
      { message: 'Analysis queued', ai_status: 'pending' },
      { status: 202 }
    );
  } catch (error) {
    console.error('Analyze error:', error);
    return NextResponse.json(
      { error: 'Failed to queue analysis' },
      { status: 500 }
    );
  }
}
