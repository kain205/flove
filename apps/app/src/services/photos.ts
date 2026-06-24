import { supabase } from '@/lib/supabase';

const avatarBucket = 'avatars';

function extensionOf(fileName: string, mimeType?: string) {
  const fromName = fileName.includes('.') ? fileName.split('.').pop() : '';
  const ext = (fromName || mimeType?.split('/').pop() || 'jpg').toLowerCase();
  return ext.replace(/[^a-z0-9]/g, '') || 'jpg';
}

/**
 * Uploads a profile photo to the public `avatars` bucket and returns its public URL.
 * The path is namespaced by the authenticated user id so the owner-write RLS policy applies.
 */
export async function uploadAvatar(file: Blob, fileName: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const contentType = file.type || 'image/jpeg';
  const ext = extensionOf(fileName, contentType);
  const path = `${auth.user.id}/avatar-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(avatarBucket).upload(path, file, {
    upsert: true,
    contentType,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(avatarBucket).getPublicUrl(path);
  return data.publicUrl;
}
