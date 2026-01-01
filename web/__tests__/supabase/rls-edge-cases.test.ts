/**
 * @jest-environment node
 */
import { SupabaseClient } from '@supabase/supabase-js';
import {
  createAdminClient,
  createAnonClient,
  createTestUser,
  cleanupTestUser,
  generateTestEmail,
  TestUser,
} from '../utils/test-helpers';

describe('RLS Edge Cases & Attack Vectors', () => {
  let adminClient: SupabaseClient;
  let userA: TestUser;
  let userB: TestUser;
  let userAStreamId: string;

  beforeAll(async () => {
    adminClient = createAdminClient();

    userA = await createTestUser(adminClient, generateTestEmail('edge-a'));
    userB = await createTestUser(adminClient, generateTestEmail('edge-b'));

    const { data: streamA } = await userA.client
      .from('photo_streams')
      .insert({ user_id: userA.user.id, name: 'Edge Test Stream' })
      .select()
      .single();
    userAStreamId = streamA!.id;
  });

  afterAll(async () => {
    await cleanupTestUser(adminClient, userA.user.id);
    await cleanupTestUser(adminClient, userB.user.id);
  });

  describe('Unauthenticated access', () => {
    let anonClient: SupabaseClient;

    beforeAll(() => {
      anonClient = createAnonClient();
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

    it('Anonymous user cannot SELECT any photos', async () => {
      const { data } = await anonClient.from('photos').select();
      expect(data).toHaveLength(0);
    });

    it('Anonymous user cannot INSERT photos', async () => {
      const { error } = await anonClient.from('photos').insert({
        stream_id: userAStreamId,
        user_id: '00000000-0000-0000-0000-000000000000',
        storage_path: '/anon/attack.jpg',
        filename: 'attack.jpg',
        mime_type: 'image/jpeg',
        file_size: 1000,
      });
      expect(error).not.toBeNull();
    });

    it('Anonymous user cannot SELECT any api_keys', async () => {
      const { data } = await anonClient.from('api_keys').select();
      expect(data).toHaveLength(0);
    });

    it('Anonymous user cannot SELECT any otp_secrets', async () => {
      const { data } = await anonClient.from('otp_secrets').select();
      expect(data).toHaveLength(0);
    });

    it('Anonymous user cannot access storage', async () => {
      const { data, error } = await anonClient.storage.from('photos').list('/');
      // Storage returns empty array (not error) for unauthorized access to prevent enumeration
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  });

  describe('SQL injection prevention', () => {
    it('should handle malicious stream names safely', async () => {
      await userA.client
        .from('photo_streams')
        .insert({
          user_id: userA.user.id,
          name: "'; DROP TABLE photo_streams; --",
        });

      const { data } = await adminClient.from('photo_streams').select().limit(1);
      expect(data).not.toBeNull();
    });

    it('should handle malicious description safely', async () => {
      await userA.client.from('photo_streams').insert({
        user_id: userA.user.id,
        name: 'Injection Test',
        description: "'); DELETE FROM photo_streams WHERE ('1'='1",
      });

      const { data } = await adminClient.from('photo_streams').select().limit(1);
      expect(data).not.toBeNull();
    });

    it('should handle malicious filename safely', async () => {
      await adminClient.from('photos').insert({
        stream_id: userAStreamId,
        user_id: userA.user.id,
        storage_path: '/test/injection.jpg',
        filename: "test'; DROP TABLE photos; --.jpg",
        mime_type: 'image/jpeg',
        file_size: 1000,
      });

      const { data } = await adminClient.from('photos').select().limit(1);
      expect(data).not.toBeNull();
    });
  });

  describe('Bulk operation security', () => {
    beforeAll(async () => {
      await userA.client.from('photo_streams').insert([
        { user_id: userA.user.id, name: 'Bulk Test 1' },
        { user_id: userA.user.id, name: 'Bulk Test 2' },
      ]);

      await userB.client.from('photo_streams').insert({
        user_id: userB.user.id,
        name: 'User B Bulk Stream',
      });
    });

    it('Bulk SELECT only returns own records', async () => {
      const { data } = await userA.client.from('photo_streams').select();

      const allOwnedByA = data?.every((s) => s.user_id === userA.user.id);
      expect(allOwnedByA).toBe(true);
    });

    it('Bulk DELETE only affects own records', async () => {
      const { data: userBStreamsBefore } = await adminClient
        .from('photo_streams')
        .select()
        .eq('user_id', userB.user.id);
      const countBefore = userBStreamsBefore?.length || 0;

      await userA.client.from('photo_streams').delete().neq('id', '');

      const { data: userBStreamsAfter } = await adminClient
        .from('photo_streams')
        .select()
        .eq('user_id', userB.user.id);

      expect(userBStreamsAfter?.length).toBe(countBefore);
    });

    it('Bulk UPDATE only affects own records', async () => {
      const { data: recreated } = await userA.client
        .from('photo_streams')
        .insert({ user_id: userA.user.id, name: 'Recreated Stream' })
        .select()
        .single();

      await userA.client
        .from('photo_streams')
        .update({ name: 'Updated By A' })
        .neq('id', '');

      const { data: userBStreams } = await adminClient
        .from('photo_streams')
        .select()
        .eq('user_id', userB.user.id);

      const anyUpdatedByA = userBStreams?.some((s) => s.name === 'Updated By A');
      expect(anyUpdatedByA).toBe(false);
    });
  });

  describe('ID enumeration attacks', () => {
    it('Cannot enumerate stream IDs via direct access', async () => {
      const { data: allStreams } = await adminClient
        .from('photo_streams')
        .select('id')
        .eq('user_id', userB.user.id);

      for (const stream of allStreams || []) {
        const { data } = await userA.client
          .from('photo_streams')
          .select()
          .eq('id', stream.id);

        expect(data).toHaveLength(0);
      }
    });

    it('Cannot enumerate photo IDs via direct access', async () => {
      const { data: photo } = await adminClient
        .from('photos')
        .insert({
          stream_id: userAStreamId,
          user_id: userA.user.id,
          storage_path: '/enum/test.jpg',
          filename: 'enum.jpg',
          mime_type: 'image/jpeg',
          file_size: 1000,
        })
        .select()
        .single();

      const { data: accessedByB } = await userB.client
        .from('photos')
        .select()
        .eq('id', photo!.id);

      expect(accessedByB).toHaveLength(0);
    });
  });

  describe('Cross-resource attacks', () => {
    it('Cannot use valid stream ID from user A in user B photo insert', async () => {
      const { error } = await userB.client.from('photos').insert({
        stream_id: userAStreamId,
        user_id: userB.user.id,
        storage_path: '/cross/attack.jpg',
        filename: 'attack.jpg',
        mime_type: 'image/jpeg',
        file_size: 1000,
      });

      expect(error).not.toBeNull();
    });

    it('Cannot use valid stream ID from user A in user B API key creation', async () => {
      const { error } = await userB.client.from('api_keys').insert({
        user_id: userB.user.id,
        stream_id: userAStreamId,
        key_hash: 'cross_resource_attack',
        name: 'Cross Resource Attack',
      });

      expect(error).not.toBeNull();
    });
  });

  describe('User ID spoofing attempts', () => {
    it('Cannot INSERT stream with different user_id', async () => {
      const { error } = await userB.client.from('photo_streams').insert({
        user_id: userA.user.id,
        name: 'Spoofed Stream',
      });

      expect(error).not.toBeNull();
    });

    it('Cannot INSERT OTP secret for another user', async () => {
      const { error } = await userB.client.from('otp_secrets').insert({
        user_id: userA.user.id,
        secret: 'SPOOFED_SECRET',
      });

      expect(error).not.toBeNull();
    });
  });
});
