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
    }, payload => {
      const row = (payload.new ?? payload.old) as { conversation_id?: string };
      void queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
      if (row.conversation_id) {
        void queryClient.invalidateQueries({ queryKey: ['messages', userId, row.conversation_id] });
      }
    })
    .subscribe();
}
