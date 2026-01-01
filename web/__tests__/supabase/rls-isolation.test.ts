/**
 * @jest-environment node
 */
import { SupabaseClient, User } from '@supabase/supabase-js';
import {
  createAdminClient,
  createTestUser,
  cleanupTestUser,
  generateTestEmail,
  TestUser,
} from '../utils/test-helpers';

describe('Multi-Tenant RLS Security', () => {
  let adminClient: SupabaseClient;
  let userA: TestUser;
  let userB: TestUser;
  let userAStreamId: string;
  let userBStreamId: string;
  let userAPhotoId: string;

  beforeAll(async () => {
    adminClient = createAdminClient();

    userA = await createTestUser(adminClient, generateTestEmail('user-a'));
    userB = await createTestUser(adminClient, generateTestEmail('user-b'));

    const { data: streamA } = await userA.client
      .from('photo_streams')
      .insert({ user_id: userA.user.id, name: 'User A Stream' })
      .select()
      .single();
    userAStreamId = streamA!.id;

    const { data: streamB } = await userB.client
      .from('photo_streams')
      .insert({ user_id: userB.user.id, name: 'User B Stream' })
      .select()
      .single();
    userBStreamId = streamB!.id;

    const { data: photoA } = await adminClient
      .from('photos')
      .insert({
        stream_id: userAStreamId,
        user_id: userA.user.id,
        storage_path: '/a/photo1.jpg',
        filename: 'photo1.jpg',
        mime_type: 'image/jpeg',
        file_size: 1000,
      })
      .select()
      .single();
    userAPhotoId = photoA!.id;
  });

  afterAll(async () => {
    await cleanupTestUser(adminClient, userA.user.id);
    await cleanupTestUser(adminClient, userB.user.id);
  });

  describe('photo_streams isolation', () => {
    it('User A can only SELECT their own streams', async () => {
      const { data } = await userA.client.from('photo_streams').select();

      expect(data?.length).toBeGreaterThan(0);
      const allOwnedByA = data?.every((s) => s.user_id === userA.user.id);
      expect(allOwnedByA).toBe(true);
    });

    it('User B cannot SELECT User A streams', async () => {
      const { data } = await userB.client
        .from('photo_streams')
        .select()
        .eq('id', userAStreamId);

      expect(data).toHaveLength(0);
    });

    it('User B cannot UPDATE User A streams', async () => {
      await userB.client
        .from('photo_streams')
        .update({ name: 'Hacked!' })
        .eq('id', userAStreamId);

      const { data } = await adminClient
        .from('photo_streams')
        .select('name')
        .eq('id', userAStreamId)
        .single();

      expect(data?.name).toBe('User A Stream');
    });

    it('User B cannot DELETE User A streams', async () => {
      await userB.client.from('photo_streams').delete().eq('id', userAStreamId);

      const { data } = await adminClient
        .from('photo_streams')
        .select()
        .eq('id', userAStreamId);

      expect(data).toHaveLength(1);
    });
  });

  describe('photos isolation', () => {
    it('User B cannot SELECT User A photos', async () => {
      const { data } = await userB.client
        .from('photos')
        .select()
        .eq('id', userAPhotoId);

      expect(data).toHaveLength(0);
    });

    it('User B cannot INSERT photo into User A stream', async () => {
      const { error } = await userB.client.from('photos').insert({
        stream_id: userAStreamId,
        user_id: userB.user.id,
        storage_path: '/b/attack.jpg',
        filename: 'attack.jpg',
        mime_type: 'image/jpeg',
        file_size: 1000,
      });

      expect(error).not.toBeNull();
    });

    it('User B cannot INSERT photo claiming to be User A', async () => {
      const { error } = await userB.client.from('photos').insert({
        stream_id: userBStreamId,
        user_id: userA.user.id,
        storage_path: '/b/impersonate.jpg',
        filename: 'impersonate.jpg',
        mime_type: 'image/jpeg',
        file_size: 1000,
      });

      expect(error).not.toBeNull();
    });

    it('User B cannot UPDATE User A photos', async () => {
      await userB.client
        .from('photos')
        .update({ filename: 'hacked.jpg' })
        .eq('id', userAPhotoId);

      const { data } = await adminClient
        .from('photos')
        .select('filename')
        .eq('id', userAPhotoId)
        .single();

      expect(data?.filename).toBe('photo1.jpg');
    });

    it('User B cannot DELETE User A photos', async () => {
      await userB.client.from('photos').delete().eq('id', userAPhotoId);

      const { data } = await adminClient
        .from('photos')
        .select()
        .eq('id', userAPhotoId);

      expect(data).toHaveLength(1);
    });
  });

  describe('api_keys isolation', () => {
    let userAKeyId: string;

    beforeAll(async () => {
      const { data } = await adminClient
        .from('api_keys')
        .insert({
          user_id: userA.user.id,
          stream_id: userAStreamId,
          key_hash: 'hash_for_user_a_rls_test',
          name: 'User A Key',
        })
        .select()
        .single();
      userAKeyId = data!.id;
    });

    it('User B cannot SELECT User A API keys', async () => {
      const { data } = await userB.client
        .from('api_keys')
        .select()
        .eq('id', userAKeyId);

      expect(data).toHaveLength(0);
    });

    it('User B cannot create API key for User A stream', async () => {
      const { error } = await userB.client.from('api_keys').insert({
        user_id: userB.user.id,
        stream_id: userAStreamId,
        key_hash: 'attack_hash_123',
        name: 'Attack Key',
      });

      expect(error).not.toBeNull();
    });

    it('User A can view and manage their own API keys', async () => {
      const { data, error } = await userA.client
        .from('api_keys')
        .select()
        .eq('id', userAKeyId);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });
  });

  describe('otp_secrets isolation', () => {
    beforeAll(async () => {
      await adminClient.from('otp_secrets').insert({
        user_id: userA.user.id,
        secret: 'SUPERSECRET',
      });
    });

    it('User B cannot SELECT User A OTP secret', async () => {
      const { data } = await userB.client
        .from('otp_secrets')
        .select()
        .eq('user_id', userA.user.id);

      expect(data).toHaveLength(0);
    });

    it('User B cannot UPDATE User A OTP secret', async () => {
      await userB.client
        .from('otp_secrets')
        .update({ secret: 'HACKED', is_enabled: true })
        .eq('user_id', userA.user.id);

      const { data } = await adminClient
        .from('otp_secrets')
        .select('secret')
        .eq('user_id', userA.user.id)
        .single();

      expect(data?.secret).toBe('SUPERSECRET');
    });

    it('User B cannot DELETE User A OTP secret', async () => {
      await userB.client.from('otp_secrets').delete().eq('user_id', userA.user.id);

      const { data } = await adminClient
        .from('otp_secrets')
        .select()
        .eq('user_id', userA.user.id);

      expect(data).toHaveLength(1);
    });

    it('User A can view their own OTP secret', async () => {
      const { data, error } = await userA.client
        .from('otp_secrets')
        .select()
        .eq('user_id', userA.user.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });
  });

  describe('storage isolation', () => {
    it('User B cannot access User A storage path', async () => {
      const { data, error } = await userB.client.storage
        .from('photos')
        .list(userA.user.id);

      // Storage returns empty array (not error) for unauthorized access to prevent enumeration
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('User B cannot upload to User A folder', async () => {
      const file = new Blob(['fake'], { type: 'image/jpeg' });
      const { error } = await userB.client.storage
        .from('photos')
        .upload(`${userA.user.id}/attack.jpg`, file);

      expect(error).not.toBeNull();
    });

    it('User A can access their own storage path', async () => {
      const { error } = await userA.client.storage
        .from('photos')
        .list(userA.user.id);

      expect(error).toBeNull();
    });
  });
});
