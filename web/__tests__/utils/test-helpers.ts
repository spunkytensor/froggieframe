import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

export interface TestUser {
  user: User;
  client: SupabaseClient;
}

export function createAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function createAnonClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function createTestUser(
  adminClient: SupabaseClient,
  email: string
): Promise<TestUser> {
  const password = 'testpass123';

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    throw new Error(`Failed to create test user: ${error?.message}`);
  }

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  await client.auth.signInWithPassword({ email, password });

  return { user: data.user, client };
}

export async function cleanupTestUser(
  adminClient: SupabaseClient,
  userId: string
): Promise<void> {
  await adminClient.auth.admin.deleteUser(userId);
}

export function generateTestEmail(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}-${timestamp}-${random}@test.local`;
}
