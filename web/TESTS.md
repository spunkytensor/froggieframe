# Database CI Tests Proposal

## Test Tracking

### Database & RLS Tests (Implemented)
- [x] Schema Correctness Tests
- [x] RLS Multi-User Isolation Tests  
- [x] RLS Edge Cases & Attack Vectors
- [x] Test Helper Utilities

### API Route Tests
- [ ] Authentication flow (sign-up, sign-in, sign-out, password reset)
- [ ] API key validation and rate limiting
- [ ] Photo upload/download endpoints
- [ ] Stream CRUD operations via API routes

### Storage Integration Tests
- [ ] Image upload with valid/invalid MIME types
- [ ] File size limit enforcement
- [ ] Thumbnail generation
- [ ] Storage quota enforcement per user

### OTP/2FA Flow Tests
- [ ] OTP secret generation and verification
- [ ] TOTP code validation (time-based)
- [ ] Recovery flow when OTP is enabled

### Pi-Frame API Tests
- [ ] Frame registration/pairing flow
- [ ] Photo sync endpoint behavior
- [ ] Slideshow interval and shuffle settings propagation

### Edge Cases
- [ ] Concurrent photo uploads to same stream
- [ ] Stream deletion with active frame connections
- [ ] User account deletion cleanup (storage, sessions, keys)

### Error Handling
- [ ] Graceful handling of Supabase outages
- [ ] Invalid JWT token responses
- [ ] Malformed request payloads

---

## Overview

This document proposes enabling Jest tests for the web app that run against a local Supabase instance in CI. Tests will only trigger when changes are made to Supabase-related files.

## Trigger Paths

The workflow will run on PRs to `main` when changes are detected in:
- `web/supabase/**` - Migrations, config, seeds
- `web/lib/supabase/**` - Client/server Supabase utilities

## Proposed Workflow

```yaml
# .github/workflows/db-local.yml
name: DB Local

on:
  pull_request:
    branches: [main]
    paths:
      - 'web/supabase/**'
      - 'web/lib/supabase/**'

jobs:
  test:
    runs-on: arc-runner-set

    defaults:
      run:
        working-directory: web

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: web/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Start Supabase local instance
        run: supabase start

      - name: Start Next.js dev server
        run: |
          node scripts/setup_env.cjs
          npm run dev -- -p 4000 &

      - name: Wait for dev server to be ready
        run: npx wait-on http://localhost:4000 --timeout 60000

      - name: Run Jest tests
        run: npm test
```

## Required Setup

### 1. Install Jest Dependencies

Add to `web/package.json`:

```json
{
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^14.2.0",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "ts-jest": "^29.1.2"
  },
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### 2. Create Jest Configuration

Create `web/jest.config.js`:

```js
const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/*.test.[jt]s?(x)',
  ],
};

module.exports = createJestConfig(customJestConfig);
```

### 3. Create Jest Setup File

Create `web/jest.setup.ts`:

```ts
import '@testing-library/jest-dom';

// Mock Supabase environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Local dev key
```

## Proposed Test Structure

```
web/
├── __tests__/
│   ├── supabase/
│   │   ├── client.test.ts      # Client-side Supabase tests
│   │   ├── server.test.ts      # Server-side Supabase tests
│   │   └── migrations.test.ts  # Verify migrations apply correctly
│   └── integration/
│       ├── auth.test.ts        # Auth flow tests
│       └── frames.test.ts      # Frame CRUD operations
```

## High-Value Test Categories

### 1. Schema Correctness Tests

Verify that migrations create the expected schema with proper constraints.

```ts
// __tests__/supabase/schema.test.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

describe('Database Schema Correctness', () => {
  let adminClient: SupabaseClient;

  beforeAll(() => {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  });

  describe('photo_streams table', () => {
    it('should exist with required columns', async () => {
      const { data, error } = await adminClient.rpc('to_jsonb', {
        sql: `SELECT column_name, data_type, is_nullable 
              FROM information_schema.columns 
              WHERE table_name = 'photo_streams'`
      });
      
      const columns = data.map((c: any) => c.column_name);
      expect(columns).toContain('id');
      expect(columns).toContain('user_id');
      expect(columns).toContain('name');
      expect(columns).toContain('slideshow_interval');
      expect(columns).toContain('shuffle');
    });

    it('should have user_id as NOT NULL', async () => {
      const { error } = await adminClient
        .from('photo_streams')
        .insert({ name: 'Test', user_id: null } as any);
      
      expect(error).not.toBeNull();
      expect(error?.message).toContain('null value');
    });

    it('should cascade delete when user is deleted', async () => {
      // Create test user, stream, then delete user
      const { data: user } = await adminClient.auth.admin.createUser({
        email: 'cascade-test@example.com',
        password: 'testpass123',
        email_confirm: true,
      });
      
      await adminClient.from('photo_streams').insert({
        user_id: user.user!.id,
        name: 'Test Stream',
      });
      
      await adminClient.auth.admin.deleteUser(user.user!.id);
      
      const { data: streams } = await adminClient
        .from('photo_streams')
        .select()
        .eq('user_id', user.user!.id);
      
      expect(streams).toHaveLength(0);
    });
  });

  describe('photos table', () => {
    it('should enforce foreign key to photo_streams', async () => {
      const fakeStreamId = '00000000-0000-0000-0000-000000000000';
      const { error } = await adminClient.from('photos').insert({
        stream_id: fakeStreamId,
        user_id: fakeStreamId,
        storage_path: '/test',
        filename: 'test.jpg',
        mime_type: 'image/jpeg',
        file_size: 1000,
      });
      
      expect(error).not.toBeNull();
      expect(error?.message).toContain('foreign key');
    });
  });

  describe('api_keys table', () => {
    it('should enforce unique key_hash constraint', async () => {
      // Attempt to insert duplicate key_hash should fail
      // (tested via service role to bypass RLS)
    });
  });

  describe('otp_secrets table', () => {
    it('should enforce one OTP secret per user (UNIQUE constraint)', async () => {
      const { data: user } = await adminClient.auth.admin.createUser({
        email: 'otp-unique-test@example.com',
        password: 'testpass123',
        email_confirm: true,
      });

      await adminClient.from('otp_secrets').insert({
        user_id: user.user!.id,
        secret: 'SECRET123',
      });

      const { error } = await adminClient.from('otp_secrets').insert({
        user_id: user.user!.id,
        secret: 'SECRET456',
      });

      expect(error).not.toBeNull();
      expect(error?.code).toBe('23505'); // unique_violation

      // Cleanup
      await adminClient.auth.admin.deleteUser(user.user!.id);
    });
  });

  describe('indexes', () => {
    it('should have performance indexes on foreign keys', async () => {
      const { data } = await adminClient.rpc('to_jsonb', {
        sql: `SELECT indexname FROM pg_indexes WHERE tablename = 'photos'`
      });
      
      const indexNames = data.map((i: any) => i.indexname);
      expect(indexNames).toContain('idx_photos_stream_id');
      expect(indexNames).toContain('idx_photos_user_id');
    });
  });
});
```

### 2. Multi-Tenant Security Tests (RLS)

Critical tests to verify complete tenant isolation.

```ts
// __tests__/supabase/multi-tenant-security.test.ts
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

describe('Multi-Tenant Security (RLS)', () => {
  let adminClient: SupabaseClient;
  let userAClient: SupabaseClient;
  let userBClient: SupabaseClient;
  let userA: User;
  let userB: User;
  let userAStreamId: string;
  let userBStreamId: string;

  beforeAll(async () => {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Create two test users
    const { data: dataA } = await adminClient.auth.admin.createUser({
      email: 'tenant-a@example.com',
      password: 'testpass123',
      email_confirm: true,
    });
    userA = dataA.user!;

    const { data: dataB } = await adminClient.auth.admin.createUser({
      email: 'tenant-b@example.com',
      password: 'testpass123',
      email_confirm: true,
    });
    userB = dataB.user!;

    // Create authenticated clients for each user
    userAClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await userAClient.auth.signInWithPassword({
      email: 'tenant-a@example.com',
      password: 'testpass123',
    });

    userBClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    await userBClient.auth.signInWithPassword({
      email: 'tenant-b@example.com',
      password: 'testpass123',
    });

    // Create streams for each user
    const { data: streamA } = await userAClient
      .from('photo_streams')
      .insert({ user_id: userA.id, name: 'User A Stream' })
      .select()
      .single();
    userAStreamId = streamA!.id;

    const { data: streamB } = await userBClient
      .from('photo_streams')
      .insert({ user_id: userB.id, name: 'User B Stream' })
      .select()
      .single();
    userBStreamId = streamB!.id;
  });

  afterAll(async () => {
    await adminClient.auth.admin.deleteUser(userA.id);
    await adminClient.auth.admin.deleteUser(userB.id);
  });

  describe('photo_streams isolation', () => {
    it('User A cannot SELECT User B streams', async () => {
      const { data } = await userAClient
        .from('photo_streams')
        .select()
        .eq('id', userBStreamId);
      
      expect(data).toHaveLength(0);
    });

    it('User A cannot UPDATE User B streams', async () => {
      const { error } = await userAClient
        .from('photo_streams')
        .update({ name: 'Hacked!' })
        .eq('id', userBStreamId);
      
      // RLS silently returns no rows updated
      const { data } = await adminClient
        .from('photo_streams')
        .select('name')
        .eq('id', userBStreamId)
        .single();
      
      expect(data?.name).toBe('User B Stream');
    });

    it('User A cannot DELETE User B streams', async () => {
      await userAClient
        .from('photo_streams')
        .delete()
        .eq('id', userBStreamId);
      
      const { data } = await adminClient
        .from('photo_streams')
        .select()
        .eq('id', userBStreamId);
      
      expect(data).toHaveLength(1);
    });

    it('User A cannot INSERT stream with User B user_id', async () => {
      const { error } = await userAClient
        .from('photo_streams')
        .insert({ user_id: userB.id, name: 'Impersonation Attack' });
      
      expect(error).not.toBeNull();
    });
  });

  describe('photos isolation', () => {
    let userAPhotoId: string;

    beforeAll(async () => {
      const { data } = await userAClient.from('photos').insert({
        stream_id: userAStreamId,
        user_id: userA.id,
        storage_path: '/a/test.jpg',
        filename: 'test.jpg',
        mime_type: 'image/jpeg',
        file_size: 1000,
      }).select().single();
      userAPhotoId = data!.id;
    });

    it('User B cannot SELECT User A photos', async () => {
      const { data } = await userBClient
        .from('photos')
        .select()
        .eq('id', userAPhotoId);
      
      expect(data).toHaveLength(0);
    });

    it('User B cannot INSERT photo into User A stream', async () => {
      const { error } = await userBClient.from('photos').insert({
        stream_id: userAStreamId, // User A's stream
        user_id: userB.id,
        storage_path: '/b/attack.jpg',
        filename: 'attack.jpg',
        mime_type: 'image/jpeg',
        file_size: 1000,
      });
      
      expect(error).not.toBeNull();
    });

    it('User B cannot INSERT photo claiming to be User A', async () => {
      const { error } = await userBClient.from('photos').insert({
        stream_id: userBStreamId,
        user_id: userA.id, // Impersonation attempt
        storage_path: '/b/impersonate.jpg',
        filename: 'impersonate.jpg',
        mime_type: 'image/jpeg',
        file_size: 1000,
      });
      
      expect(error).not.toBeNull();
    });
  });

  describe('api_keys isolation', () => {
    it('User B cannot SELECT User A API keys', async () => {
      await userAClient.from('api_keys').insert({
        user_id: userA.id,
        stream_id: userAStreamId,
        key_hash: 'hash_for_user_a_secret',
        name: 'User A Key',
      });

      const { data } = await userBClient
        .from('api_keys')
        .select()
        .eq('name', 'User A Key');
      
      expect(data).toHaveLength(0);
    });

    it('User B cannot create API key for User A stream', async () => {
      const { error } = await userBClient.from('api_keys').insert({
        user_id: userB.id,
        stream_id: userAStreamId, // User A's stream
        key_hash: 'attack_hash',
        name: 'Attack Key',
      });
      
      expect(error).not.toBeNull();
    });
  });

  describe('otp_secrets isolation', () => {
    it('User B cannot SELECT User A OTP secret', async () => {
      await adminClient.from('otp_secrets').insert({
        user_id: userA.id,
        secret: 'SUPERSECRET',
      });

      const { data } = await userBClient
        .from('otp_secrets')
        .select()
        .eq('user_id', userA.id);
      
      expect(data).toHaveLength(0);
    });

    it('User B cannot UPDATE User A OTP secret', async () => {
      await userBClient
        .from('otp_secrets')
        .update({ secret: 'HACKED', is_enabled: true })
        .eq('user_id', userA.id);
      
      const { data } = await adminClient
        .from('otp_secrets')
        .select('secret')
        .eq('user_id', userA.id)
        .single();
      
      expect(data?.secret).toBe('SUPERSECRET');
    });
  });

  describe('storage isolation', () => {
    it('User B cannot access User A storage path', async () => {
      const { error } = await userBClient.storage
        .from('photos')
        .list(userA.id); // Trying to list User A's folder
      
      expect(error).not.toBeNull();
    });

    it('User B cannot upload to User A folder', async () => {
      const file = new Blob(['fake'], { type: 'image/jpeg' });
      const { error } = await userBClient.storage
        .from('photos')
        .upload(`${userA.id}/attack.jpg`, file);
      
      expect(error).not.toBeNull();
    });
  });
});
```

### 3. RLS Edge Cases & Attack Vectors

```ts
// __tests__/supabase/rls-edge-cases.test.ts
describe('RLS Edge Cases & Attack Vectors', () => {
  // ... setup similar to above

  describe('Unauthenticated access', () => {
    let anonClient: SupabaseClient;

    beforeAll(() => {
      anonClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      // NOT signed in
    });

    it('Anonymous user cannot SELECT any photo_streams', async () => {
      const { data } = await anonClient.from('photo_streams').select();
      expect(data).toHaveLength(0);
    });

    it('Anonymous user cannot INSERT photo_streams', async () => {
      const { error } = await anonClient.from('photo_streams').insert({
        user_id: '00000000-0000-0000-0000-000000000000',
        name: 'Anonymous Attack',
      });
      expect(error).not.toBeNull();
    });

    it('Anonymous user cannot access storage', async () => {
      const { error } = await anonClient.storage.from('photos').list('/');
      expect(error).not.toBeNull();
    });
  });

  describe('SQL injection prevention', () => {
    it('should handle malicious stream names safely', async () => {
      const { error } = await userAClient.from('photo_streams').insert({
        user_id: userA.id,
        name: "'; DROP TABLE photo_streams; --",
      });
      
      // Should either succeed (escaped) or fail validation, never execute injection
      const { data } = await adminClient.from('photo_streams').select().limit(1);
      expect(data).not.toBeNull(); // Table still exists
    });
  });

  describe('Bulk operation security', () => {
    it('Bulk SELECT only returns own records', async () => {
      const { data } = await userAClient
        .from('photo_streams')
        .select();
      
      const allOwnedByA = data?.every((s) => s.user_id === userA.id);
      expect(allOwnedByA).toBe(true);
    });

    it('Bulk DELETE only affects own records', async () => {
      // Create multiple streams for User A
      await userAClient.from('photo_streams').insert([
        { user_id: userA.id, name: 'Bulk 1' },
        { user_id: userA.id, name: 'Bulk 2' },
      ]);

      // User A tries to delete ALL streams (no filter)
      await userAClient.from('photo_streams').delete().neq('id', '');
      
      // User B's stream should still exist
      const { data } = await adminClient
        .from('photo_streams')
        .select()
        .eq('user_id', userB.id);
      
      expect(data!.length).toBeGreaterThan(0);
    });
  });
});
```

### 4. Helper Function for Tests

Add this utility for creating test users:

```ts
// __tests__/utils/test-helpers.ts
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

export async function createTestUser(
  adminClient: SupabaseClient,
  email: string
): Promise<{ user: User; client: SupabaseClient }> {
  const password = 'testpass123';
  
  const { data } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  await client.auth.signInWithPassword({ email, password });
  
  return { user: data.user!, client };
}

export async function cleanupTestUser(
  adminClient: SupabaseClient,
  userId: string
): Promise<void> {
  await adminClient.auth.admin.deleteUser(userId);
}
```

## Implementation Phases

| Phase | Task | Effort |
|-------|------|--------|
| 1 | Install Jest + configure | 1 hour |
| 2 | Create migration verification tests | 2 hours |
| 3 | Create client/server integration tests | 3 hours |
| 4 | Add workflow file | 30 min |
| 5 | Document test patterns | 1 hour |

## Notes

- Local Supabase uses predictable keys (safe to hardcode in test setup)
- Tests run in `web/` directory via `defaults.run.working-directory`
- Consider adding `supabase db reset` step if tests need clean state between runs
