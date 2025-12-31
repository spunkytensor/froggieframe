import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as OTPAuth from 'otpauth';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { error: 'Invalid code format' },
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

    // Get OTP secret
    const { data: otpData } = await supabase
      .from('otp_secrets')
      .select('secret')
      .eq('user_id', user.id)
      .eq('is_enabled', true)
      .single();

    if (!otpData) {
      return NextResponse.json(
        { error: '2FA not enabled' },
        { status: 400 }
      );
    }

    // Verify the code
    const totp = new OTPAuth.TOTP({
      issuer: 'Froggie Frame',
      label: user.email || 'user',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(otpData.secret),
    });

    const delta = totp.validate({ token: code, window: 1 });

    if (delta === null) {
      return NextResponse.json(
        { error: 'Invalid code' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('OTP verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
