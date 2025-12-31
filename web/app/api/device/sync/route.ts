import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { hashApiKey } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-API-Key');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { stream_id, synced_count, total_count, cache_size_mb } = body;

    const supabase = createServiceClient();

    // Verify API key
    const keyHash = await hashApiKey(apiKey);
    const { data: apiKeyData } = await supabase
      .from('api_keys')
      .select('id')
      .eq('key_hash', keyHash)
      .eq('stream_id', stream_id)
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

    // Log sync status (could be expanded to store in a separate table)
    console.log('Device sync:', {
      stream_id,
      synced_count,
      total_count,
      cache_size_mb,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Device sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed' },
      { status: 500 }
    );
  }
}
