import { createServiceClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export interface RateLimitConfig {
  endpoint: string;
  maxAttempts: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  OTP_VERIFY: {
    endpoint: 'otp_verify',
    maxAttempts: 5,
    windowSeconds: 900, // 15 minutes
  },
  OTP_DISABLE: {
    endpoint: 'otp_disable',
    maxAttempts: 5,
    windowSeconds: 900, // 15 minutes
  },
  API_KEY_GENERATE: {
    endpoint: 'api_key_generate',
    maxAttempts: 10,
    windowSeconds: 3600, // 1 hour
  },
  PHOTO_UPLOAD: {
    endpoint: 'photo_upload',
    maxAttempts: 100,
    windowSeconds: 3600, // 1 hour
  },
} as const;

export async function getClientIdentifier(userId?: string): Promise<string> {
  if (userId) {
    return `user:${userId}`;
  }
  
  const headersList = await headers();
  const forwardedFor = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';
  
  return `ip:${ip}`;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const supabase = createServiceClient();
  
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_identifier: identifier,
    p_endpoint: config.endpoint,
    p_max_attempts: config.maxAttempts,
    p_window_seconds: config.windowSeconds,
  });

  if (error) {
    console.error('Rate limit check failed:', error);
    return { allowed: true };
  }

  return {
    allowed: data === true,
    retryAfterSeconds: data === false ? config.windowSeconds : undefined,
  };
}

export function rateLimitResponse(retryAfterSeconds: number = 900): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please try again later.' },
    { 
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}
