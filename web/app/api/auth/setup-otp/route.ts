import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Generate a new secret
    const secret = new OTPAuth.Secret({ size: 20 });

    const totp = new OTPAuth.TOTP({
      issuer: 'Froggie Frame',
      label: user.email || 'user',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: secret,
    });

    const otpauthUrl = totp.toString();
    const qrCode = await QRCode.toDataURL(otpauthUrl);

    // Store the secret (not enabled yet)
    await supabase.from('otp_secrets').upsert({
      user_id: user.id,
      secret: secret.base32,
      is_enabled: false,
    });

    return NextResponse.json({
      secret: secret.base32,
      qrCode,
    });
  } catch (error) {
    console.error('OTP setup error:', error);
    return NextResponse.json(
      { error: 'Setup failed' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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

    // Get the pending OTP secret
    const { data: otpData } = await supabase
      .from('otp_secrets')
      .select('secret')
      .eq('user_id', user.id)
      .eq('is_enabled', false)
      .single();

    if (!otpData) {
      return NextResponse.json(
        { error: 'No pending 2FA setup' },
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

    // Enable 2FA
    await supabase
      .from('otp_secrets')
      .update({ is_enabled: true })
      .eq('user_id', user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('OTP verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { error: 'Current OTP code is required to disable 2FA' },
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

    const { data: otpData } = await supabase
      .from('otp_secrets')
      .select('secret')
      .eq('user_id', user.id)
      .eq('is_enabled', true)
      .single();

    if (!otpData) {
      return NextResponse.json(
        { error: '2FA is not enabled' },
        { status: 400 }
      );
    }

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
        { error: 'Invalid OTP code' },
        { status: 400 }
      );
    }

    await supabase
      .from('otp_secrets')
      .delete()
      .eq('user_id', user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('OTP disable error:', error);
    return NextResponse.json(
      { error: 'Failed to disable 2FA' },
      { status: 500 }
    );
  }
}
