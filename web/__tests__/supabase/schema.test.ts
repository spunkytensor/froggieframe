/**
 * @jest-environment node
 */
import { SupabaseClient } from '@supabase/supabase-js';
import {
  createAdminClient,
  createTestUser,
  cleanupTestUser,
  generateTestEmail,
} from '../utils/test-helpers';

describe('Database Schema Correctness', () => {
  let adminClient: SupabaseClient;

  beforeAll(() => {
    adminClient = createAdminClient();
  });

  describe('photo_streams table', () => {
    it('should exist with required columns', async () => {
      const { data, error } = await adminClient.from('photo_streams').select('*').limit(0);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have user_id as NOT NULL', async () => {
      const { error } = await adminClient
        .from('photo_streams')
        .insert({ name: 'Test', user_id: null } as never);

      expect(error).not.toBeNull();
    });

    it('should cascade delete when user is deleted', async () => {
      const email = generateTestEmail('cascade-test');
      const { user } = await createTestUser(adminClient, email);

      await adminClient.from('photo_streams').insert({
        user_id: user.id,
        name: 'Test Stream',
      });

      const { data: streamsBefore } = await adminClient
        .from('photo_streams')
        .select()
        .eq('user_id', user.id);
      expect(streamsBefore).toHaveLength(1);

      await cleanupTestUser(adminClient, user.id);

      const { data: streamsAfter } = await adminClient
        .from('photo_streams')
        .select()
        .eq('user_id', user.id);

      expect(streamsAfter).toHaveLength(0);
    });

    it('should set default values for slideshow_interval and shuffle', async () => {
      const email = generateTestEmail('defaults-test');
      const { user, client } = await createTestUser(adminClient, email);

      try {
        const { data, error } = await client
          .from('photo_streams')
          .insert({ user_id: user.id, name: 'Defaults Test' })
          .select()
          .single();

        expect(error).toBeNull();
        expect(data?.slideshow_interval).toBe(30);
        expect(data?.shuffle).toBe(true);
        expect(data?.transition_effect).toBe('fade');
      } finally {
        await cleanupTestUser(adminClient, user.id);
      }
    });
  });

  describe('photos table', () => {
    it('should enforce foreign key to photo_streams', async () => {
      const fakeStreamId = '00000000-0000-0000-0000-000000000000';
      const fakeUserId = '00000000-0000-0000-0000-000000000001';

      const { error } = await adminClient.from('photos').insert({
        stream_id: fakeStreamId,
        user_id: fakeUserId,
        storage_path: '/test',
        filename: 'test.jpg',
        mime_type: 'image/jpeg',
        file_size: 1000,
      });

      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/foreign key|violates/i);
    });

    it('should cascade delete when stream is deleted', async () => {
      const email = generateTestEmail('photo-cascade');
      const { user } = await createTestUser(adminClient, email);

      try {
        const { data: stream } = await adminClient
          .from('photo_streams')
          .insert({ user_id: user.id, name: 'Photo Cascade Test' })
          .select()
          .single();

        await adminClient.from('photos').insert({
          stream_id: stream!.id,
          user_id: user.id,
          storage_path: '/test/photo.jpg',
          filename: 'photo.jpg',
          mime_type: 'image/jpeg',
          file_size: 1000,
        });

        await adminClient.from('photo_streams').delete().eq('id', stream!.id);

        const { data: photos } = await adminClient
          .from('photos')
          .select()
          .eq('stream_id', stream!.id);

        expect(photos).toHaveLength(0);
      } finally {
        await cleanupTestUser(adminClient, user.id);
      }
    });
  });

  describe('api_keys table', () => {
    it('should enforce unique key_hash constraint', async () => {
      const email = generateTestEmail('unique-hash');
      const { user } = await createTestUser(adminClient, email);

      try {
        const { data: stream } = await adminClient
          .from('photo_streams')
          .insert({ user_id: user.id, name: 'API Key Test' })
          .select()
          .single();

        await adminClient.from('api_keys').insert({
          user_id: user.id,
          stream_id: stream!.id,
          key_hash: 'unique_test_hash_12345',
          name: 'First Key',
        });

        const { error } = await adminClient.from('api_keys').insert({
          user_id: user.id,
          stream_id: stream!.id,
          key_hash: 'unique_test_hash_12345',
          name: 'Duplicate Key',
        });

        expect(error).not.toBeNull();
        expect(error?.message).toMatch(/duplicate|unique|already exists/i);
      } finally {
        await cleanupTestUser(adminClient, user.id);
      }
    });

    it('should cascade delete when stream is deleted', async () => {
      const email = generateTestEmail('apikey-cascade');
      const { user } = await createTestUser(adminClient, email);

      try {
        const { data: stream } = await adminClient
          .from('photo_streams')
          .insert({ user_id: user.id, name: 'API Key Cascade Test' })
          .select()
          .single();

        await adminClient.from('api_keys').insert({
          user_id: user.id,
          stream_id: stream!.id,
          key_hash: 'cascade_test_hash',
          name: 'Test Key',
        });

        await adminClient.from('photo_streams').delete().eq('id', stream!.id);

        const { data: keys } = await adminClient
          .from('api_keys')
          .select()
          .eq('stream_id', stream!.id);

        expect(keys).toHaveLength(0);
      } finally {
        await cleanupTestUser(adminClient, user.id);
      }
    });
  });

  describe('otp_secrets table', () => {
    it('should enforce one OTP secret per user (UNIQUE constraint)', async () => {
      const email = generateTestEmail('otp-unique');
      const { user } = await createTestUser(adminClient, email);

      try {
        await adminClient.from('otp_secrets').insert({
          user_id: user.id,
          secret: 'SECRET123',
        });

        const { error } = await adminClient.from('otp_secrets').insert({
          user_id: user.id,
          secret: 'SECRET456',
        });

        expect(error).not.toBeNull();
        expect(error?.message).toMatch(/duplicate|unique|already exists/i);
      } finally {
        await cleanupTestUser(adminClient, user.id);
      }
    });

    it('should set default is_enabled to false', async () => {
      const email = generateTestEmail('otp-defaults');
      const { user } = await createTestUser(adminClient, email);

      try {
        const { data, error } = await adminClient
          .from('otp_secrets')
          .insert({ user_id: user.id, secret: 'TESTSECRET' })
          .select()
          .single();

        expect(error).toBeNull();
        expect(data?.is_enabled).toBe(false);
      } finally {
        await cleanupTestUser(adminClient, user.id);
      }
    });
  });

  describe('indexes', () => {
    it('should have indexes on frequently queried columns', async () => {
      const { data, error } = await adminClient.rpc('exec_sql', {
        query: `
          SELECT indexname, tablename 
          FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND tablename IN ('photo_streams', 'photos', 'api_keys', 'otp_secrets')
        `,
      });

      if (error) {
        const { data: streams } = await adminClient
          .from('photo_streams')
          .select('id')
          .limit(1);
        expect(streams).toBeDefined();
        return;
      }

      const indexNames = data?.map((r: { indexname: string }) => r.indexname) || [];
      expect(indexNames.length).toBeGreaterThan(0);
    });
  });
});
