import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateApiKey, hashApiKey } from '@/lib/utils';
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const { stream_id, name } = await request.json();

    if (!stream_id || !name) {
      return NextResponse.json(
        { error: 'Stream ID and name are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const identifier = await getClientIdentifier(user.id);
    const rateLimit = await checkRateLimit(identifier, RATE_LIMITS.API_KEY_GENERATE);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.retryAfterSeconds);
    }

    // Verify user owns the stream
    const { data: stream } = await supabase
      .from('photo_streams')
      .select('id')
      .eq('id', stream_id)
      .eq('user_id', user.id)
      .single();

    if (!stream) {
      return NextResponse.json(
        { error: 'Stream not found' },
        { status: 404 }
      );
    }

    // Generate API key
    const apiKey = generateApiKey();
    const keyHash = await hashApiKey(apiKey);

    // Store the key
    await supabase.from('api_keys').insert({
      user_id: user.id,
      stream_id,
      key_hash: keyHash,
      name,
    });

    return NextResponse.json({ api_key: apiKey });
  } catch (error) {
    console.error('API key generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate API key' },
      { status: 500 }
    );
  }
}
