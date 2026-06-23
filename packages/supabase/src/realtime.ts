import type { QueryClient } from '@tanstack/react-query';
import type { FloveSupabaseClient } from './client';

export function subscribeToConversationInvalidations(
  client: FloveSupabaseClient,
  queryClient: QueryClient,
  userId: string
) {
  return client
    .channel(`conversation-invalidations:${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'conversation_participants',
      filter: `user_id=eq.${userId}`,
    }, () => {
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    })
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
    }, payload => {
      const row = payload.new as { conversation_id?: string };
      void queryClient.invalidateQueries({ queryKey: ['messages', row.conversation_id] });
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    })
    .subscribe();
}
