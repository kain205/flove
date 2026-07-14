import { supabase } from '@/lib/supabase';

const avatarBucket = 'avatars';
const maxAvatarBytes = 5 * 1024 * 1024;
const avatarTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

/**
 * Uploads a profile photo to the public `avatars` bucket and returns its public URL.
 * The path is namespaced by the authenticated user id so the owner-write RLS policy applies.
 */
export async function uploadAvatar(file: Blob, _fileName: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const contentType = file.type.toLowerCase() === 'image/jpg' ? 'image/jpeg' : file.type.toLowerCase();
  const ext = avatarTypes.get(contentType);
  if (!ext) throw new Error('Ảnh phải có định dạng JPEG, PNG hoặc WebP.');
  if (file.size > maxAvatarBytes) throw new Error('Ảnh đại diện không được vượt quá 5 MiB.');
  const path = `${auth.user.id}/avatar-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(avatarBucket).upload(path, file, {
    upsert: true,
    contentType,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(avatarBucket).getPublicUrl(path);
  return data.publicUrl;
}
