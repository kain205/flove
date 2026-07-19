import { describe, expect, it } from 'vitest';
import {
  acceptCuratedMatch,
  analyzeOnboardingProfile,
  ApiRequestError,
  dailyMatchesResultFromPayload,
  findBlindDatePartner,
  getBlindDateSessionForConversation,
  listConversationMessages,
  markConversationRead,
  requestBlindDateReveal,
  sendPreferenceChatMessage,
  submitMatchFeedback,
  unlockDailyMatchBatch,
} from './functions';
import { getPreferenceChatMessages } from './queries';

describe('dailyMatchesResultFromPayload', () => {
  it('hydrates dates and exposes only pending picks', () => {
    const candidate = {
      id: 'candidate-a',
      name: 'An',
      age: 21,
      major: 'SE',
      campus: 'HCM',
      avatarUrl: '',
      bio: 'Bio',
      interests: [],
      personalityTags: [],
      datingGoals: [],
      preferredVibes: [],
      profileText: { bio: 'Bio' },
      profileCompleteness: 100,
    };
    const pick = {
      kind: 'revealed',
      id: 'pending',
      batchId: 'u1_2026-07-14',
      userId: 'u1',
      candidateId: 'candidate-a',
      candidate,
      pairKey: 'candidate-a_u1',
      aiReason: 'Lý do thật',
      compatibilityLabel: 'Tiềm năng mạnh',
      compatibilityScore: 80,
      status: 'pending',
      feedbackTags: [],
      createdAt: '2026-07-14T00:00:00.000Z',
    };
    const result = dailyMatchesResultFromPayload({
      status: 'ready',
      businessDate: '2026-07-14',
      source: 'cached',
      batch: {
        id: 'u1_2026-07-14',
        userId: 'u1',
        date: '2026-07-14',
        createdAt: '2026-07-14T00:00:00.000Z',
        mode: 'open', state: 'unlocked', priceVnd: 100000, lockedCount: 0,
        matches: [
          pick,
          { ...pick, id: 'declined', status: 'declined' },
        ],
      },
    });

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.batch.createdAt).toBeInstanceOf(Date);
    expect(result.batch.matches.map(match => match.kind === 'revealed' ? match.id : match.previewId)).toEqual(['pending']);
  });

  it('rejects identity fields on a locked preview', () => {
    expect(() => dailyMatchesResultFromPayload({
      status: 'ready',
      businessDate: '2026-07-14',
      source: 'cached',
      batch: {
        id: 'u1_2026-07-14',
        userId: 'u1',
        date: '2026-07-14',
        createdAt: '2026-07-14T00:00:00.000Z',
        mode: 'stub', state: 'locked', priceVnd: 100000, lockedCount: 1,
        matches: [{
          kind: 'locked',
          previewId: 'preview-a',
          compatibilityLabel: 'Tiềm năng mạnh',
          compatibilityScore: 80,
          candidateId: 'must-not-leak',
        }],
      },
    })).toThrow(/forbidden field/);
  });

  it('accepts an identity-free locked preview and preserves access metadata', () => {
    const result = dailyMatchesResultFromPayload({
      status: 'ready',
      businessDate: '2026-07-14',
      source: 'generated',
      batch: {
        id: 'u1_2026-07-14',
        userId: 'u1',
        date: '2026-07-14',
        createdAt: '2026-07-14T00:00:00.000Z',
        mode: 'stub', state: 'locked', priceVnd: 100000, lockedCount: 1,
        matches: [{
          kind: 'locked',
          previewId: 'preview-a',
          compatibilityLabel: 'Đáng khám phá',
          compatibilityScore: 70,
        }],
      },
    });
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.batch).toMatchObject({ mode: 'stub', state: 'locked', priceVnd: 100000, lockedCount: 1 });
    expect(result.batch.matches[0]).toEqual({
      kind: 'locked',
      previewId: 'preview-a',
      compatibilityLabel: 'Đáng khám phá',
      compatibilityScore: 70,
    });
    expect(result.batch.matches[0]).not.toHaveProperty('id');
    expect(result.batch.matches[0]).not.toHaveProperty('candidate');
  });

  it('rejects locked previews in server-open mode', () => {
    expect(() => dailyMatchesResultFromPayload({
      status: 'ready',
      businessDate: '2026-07-14',
      source: 'cached',
      batch: {
        id: 'u1_2026-07-14',
        userId: 'u1',
        date: '2026-07-14',
        createdAt: '2026-07-14T00:00:00.000Z',
        mode: 'open', state: 'unlocked', priceVnd: 100000, lockedCount: 1,
        matches: [{
          kind: 'locked',
          previewId: 'preview-a',
          compatibilityLabel: 'Đáng khám phá',
          compatibilityScore: 70,
        }],
      },
    })).toThrow(/Open AI Picks|Unlocked AI Picks/);
  });

  it('rejects every identity-bearing pick in a locked batch, including decided rows', () => {
    const candidate = {
      id: 'candidate-a', name: 'An', age: 21, major: 'SE', campus: 'HCM', avatarUrl: '', bio: 'Bio',
      interests: [], personalityTags: [], datingGoals: [], preferredVibes: [],
      profileText: { bio: 'Bio' }, profileCompleteness: 100,
    };
    expect(() => dailyMatchesResultFromPayload({
      status: 'ready',
      businessDate: '2026-07-14',
      source: 'cached',
      batch: {
        id: 'u1_2026-07-14', userId: 'u1', date: '2026-07-14', createdAt: '2026-07-14T00:00:00.000Z',
        mode: 'stub', state: 'locked', priceVnd: 100000, lockedCount: 0,
        matches: [{
          kind: 'revealed', id: 'declined', batchId: 'u1_2026-07-14', userId: 'u1',
          candidateId: 'candidate-a', candidate, pairKey: 'candidate-a_u1', aiReason: 'Lý do thật',
          compatibilityLabel: 'Tiềm năng mạnh', compatibilityScore: 80, status: 'declined',
          feedbackTags: [], createdAt: '2026-07-14T00:00:00.000Z',
        }],
      },
    })).toThrow(/locked AI Picks batch/i);
  });

  it('rejects an incomplete revealed profile before it reaches the UI', () => {
    expect(() => dailyMatchesResultFromPayload({
      status: 'ready',
      businessDate: '2026-07-14',
      source: 'cached',
      batch: {
        id: 'u1_2026-07-14',
        userId: 'u1',
        date: '2026-07-14',
        createdAt: '2026-07-14T00:00:00.000Z',
        mode: 'open', state: 'unlocked', priceVnd: 100000, lockedCount: 0,
        matches: [{
          kind: 'revealed',
          id: 'match-a',
          batchId: 'u1_2026-07-14',
          userId: 'u1',
          candidateId: 'candidate-a',
          candidate: { id: 'candidate-a', name: 'An', age: 21 },
          pairKey: 'candidate-a_u1',
          aiReason: 'Lý do thật',
          compatibilityLabel: 'Tiềm năng mạnh',
          compatibilityScore: 80,
          status: 'pending',
          feedbackTags: [],
          createdAt: '2026-07-14T00:00:00.000Z',
        }],
      },
    })).toThrow(/candidate profile text/);
  });

  it('rejects unknown response shapes', () => {
    expect(() => dailyMatchesResultFromPayload({ status: 'surprise' })).toThrow(/Unknown/);
  });
});

describe('onboarding compatibility wrappers', () => {
  it('forwards the one-release raw analyze payload unchanged', async () => {
    const calls: Array<{ name: string; body: unknown }> = [];
    const client = {
      functions: {
        invoke: async (name: string, options: { body: unknown }) => {
          calls.push({ name, body: options.body });
          return {
            data: {
              ok: true,
              analysis: { publicProfile: {}, matchingSignals: {}, aiReview: {} },
              generatedBy: 'fallback',
              draftRevision: 1,
              analysisRevision: 1,
            },
            error: null,
          };
        },
      },
    };
    const input = {
      basic: { name: 'An', age: 20 },
      answers: [{ questionId: 'self_text', value: 'raw answer' }],
    };
    await analyzeOnboardingProfile(client as never, input);
    expect(calls).toEqual([{ name: 'analyze-onboarding-profile', body: input }]);
  });

  it('forwards the expected user fence on the revision contract', async () => {
    let body: unknown;
    const client = {
      functions: {
        invoke: async (_name: string, options: { body: unknown }) => {
          body = options.body;
          return {
            data: {
              ok: true,
              analysis: { publicProfile: {}, matchingSignals: {}, aiReview: {} },
              generatedBy: 'fallback',
              draftRevision: 3,
              analysisRevision: 3,
            },
            error: null,
          };
        },
      },
    };
    await analyzeOnboardingProfile(client as never, { draftRevision: 3, expectedUserId: 'user-a' });
    expect(body).toEqual({ draftRevision: 3, expectedUserId: 'user-a' });
  });
});

describe('user-intent fences', () => {
  it('unlocks a whole batch through the owner-fenced idempotent RPC', async () => {
    let call: unknown;
    const client = {
      auth: {
        getUser: async () => ({ data: { user: { id: 'user-a' } }, error: null }),
      },
      rpc: async (name: string, input: unknown) => {
        call = { name, input };
        return {
          data: [{
            batch_id: 'batch-a',
            product_mode: 'stub',
            access_state: 'unlocked',
            price_vnd: 100000,
            applied: true,
            unlock_source: 'simulated',
          }],
          error: null,
        };
      },
    };
    await expect(unlockDailyMatchBatch(client as never, {
      batchId: 'batch-a',
      idempotencyKey: 'unlock-a',
      expectedUserId: 'user-a',
    })).resolves.toMatchObject({ batchId: 'batch-a', applied: true, accessState: 'unlocked' });
    expect(call).toEqual({
      name: 'unlock_daily_match_batch',
      input: {
        p_batch_id: 'batch-a',
        p_idempotency_key: 'unlock-a',
        p_expected_user_id: 'user-a',
      },
    });
  });

  it('forwards the expected user on preference chat', async () => {
    let body: unknown;
    const client = {
      functions: {
        invoke: async (_name: string, options: { body: unknown }) => {
          body = options.body;
          return { data: { ok: true, applied: true }, error: null };
        },
      },
    };
    await sendPreferenceChatMessage(client as never, 'clear communication', 'request-1', 'user-a');
    expect(body).toEqual({
      content: 'clear communication',
      idempotencyKey: 'request-1',
      expectedUserId: 'user-a',
    });
  });

  it('forwards the expected user on accept and feedback decisions', async () => {
    const calls: Array<{ name: string; body: unknown }> = [];
    const client = {
      functions: {
        invoke: async (name: string, options: { body: unknown }) => {
          calls.push({ name, body: options.body });
          return { data: { ok: true, isMutual: false }, error: null };
        },
      },
    };

    await acceptCuratedMatch(client as never, {
      matchId: 'match-1',
      idempotencyKey: 'accept-1',
      expectedUserId: 'user-a',
    });
    await submitMatchFeedback(client as never, {
      matchId: 'match-2',
      decision: 'declined',
      idempotencyKey: 'decline-1',
      expectedUserId: 'user-a',
    });

    expect(calls).toEqual([
      {
        name: 'accept-curated-match',
        body: { matchId: 'match-1', idempotencyKey: 'accept-1', expectedUserId: 'user-a' },
      },
      {
        name: 'submit-match-feedback',
        body: {
          matchId: 'match-2',
          decision: 'declined',
          idempotencyKey: 'decline-1',
          expectedUserId: 'user-a',
        },
      },
    ]);
  });

  it('preserves the structured API failure envelope for non-matching wrappers', async () => {
    const failure = {
      ok: false as const,
      error: {
        code: 'session_changed',
        message: 'Tài khoản đã thay đổi.',
        retryable: false,
        requestId: 'request-42',
      },
      retryAfterMs: 750,
    };
    const client = {
      functions: {
        invoke: async () => ({
          data: null,
          error: { context: new Response(JSON.stringify(failure), { status: 409 }) },
        }),
      },
    };

    const error = await sendPreferenceChatMessage(client as never, 'hello', 'key', 'user-a')
      .then(() => null, caught => caught);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      code: 'session_changed',
      retryable: false,
      requestId: 'request-42',
      retryAfterMs: 750,
    });
  });
});

describe('Blind Date privacy contracts', () => {
  it('drops a counterpart UUID even if a stale Edge deployment includes one', async () => {
    const client = {
      functions: {
        invoke: async () => ({
          data: {
            ok: true,
            waiting: false,
            sessionId: 'opaque-session',
            conversationId: 'opaque-conversation',
            partnerMaskedName: 'Quiet Coder',
            partnerId: 'must-not-cross-the-client-boundary',
          },
          error: null,
        }),
      },
    };

    const result = await findBlindDatePartner(client as never);
    expect(result).toEqual({
      ok: true,
      waiting: false,
      sessionId: 'opaque-session',
      conversationId: 'opaque-conversation',
      partnerMaskedName: 'Quiet Coder',
    });
    expect(result).not.toHaveProperty('partnerId');
  });

  it('maps messages to relative ownership and drops raw sender metadata', async () => {
    const client = {
      rpc: async () => ({
        data: [{
          id: 'message-id',
          conversation_id: 'opaque-conversation',
          content: 'hello',
          created_at: '2026-07-15T00:00:00.000Z',
          is_read: false,
          is_mine: true,
          sender_id: 'must-not-cross-the-client-boundary',
        }],
        error: null,
      }),
    };

    const [message] = await listConversationMessages(client as never, 'opaque-conversation');
    expect(message).toEqual({
      id: 'message-id',
      conversationId: 'opaque-conversation',
      content: 'hello',
      createdAt: '2026-07-15T00:00:00.000Z',
      isRead: false,
      isMine: true,
    });
    expect(message).not.toHaveProperty('senderId');
  });

  it('marks a participant conversation read through the atomic RPC', async () => {
    let call: unknown;
    const client = {
      rpc: async (name: string, input: unknown) => {
        call = { name, input };
        return {
          data: [{
            conversation_id: 'opaque-conversation',
            unread_count: 0,
            marked_read_count: 2,
            applied: true,
          }],
          error: null,
        };
      },
    };

    await expect(markConversationRead(client as never, 'opaque-conversation')).resolves.toEqual({
      conversationId: 'opaque-conversation',
      unreadCount: 0,
      markedReadCount: 2,
      applied: true,
    });
    expect(call).toEqual({
      name: 'mark_conversation_read',
      input: { p_conversation_id: 'opaque-conversation' },
    });
  });

  it('recovers opaque Blind Date state from a conversation after navigation reload', async () => {
    let args: unknown;
    const client = {
      rpc: async (name: string, input: unknown) => {
        expect(name).toBe('get_blind_date_session_for_conversation');
        args = input;
        return {
          data: [{
            session_id: 'opaque-session',
            conversation_id: 'opaque-conversation',
            partner_masked_name: 'Quiet Coder',
            requested_by_me: false,
            requested_by_partner: true,
            is_revealed: false,
            partner_id: 'must-stay-hidden',
          }],
          error: null,
        };
      },
    };

    await expect(getBlindDateSessionForConversation(client as never, 'opaque-conversation')).resolves.toEqual({
      sessionId: 'opaque-session',
      conversationId: 'opaque-conversation',
      partnerMaskedName: 'Quiet Coder',
      requestedByMe: false,
      requestedByPartner: true,
      isRevealed: false,
      partnerId: null,
    });
    expect(args).toEqual({ p_conversation_id: 'opaque-conversation' });
  });

  it('defensively masks partnerId until reveal is confirmed', async () => {
    const client = {
      functions: {
        invoke: async () => ({
          data: { ok: true, accepted: false, isRevealed: false, partnerId: 'hidden-id' },
          error: null,
        }),
      },
    };

    await expect(requestBlindDateReveal(client as never, 'opaque-session')).resolves.toMatchObject({
      isRevealed: false,
      partnerId: null,
    });
  });
});

describe('preference chat query contract', () => {
  it('scopes the owner query and excludes request/idempotency metadata', async () => {
    const calls: Array<[string, unknown]> = [];
    const rows = [{
      id: 'm1',
      sender: 'assistant',
      content: 'Saved.',
      created_at: '2026-07-15T00:00:00.000Z',
    }];
    const builder = {
      select: (columns: string) => { calls.push(['select', columns]); return builder; },
      eq: (column: string, value: string) => { calls.push(['eq', [column, value]]); return builder; },
      order: (column: string, options: unknown) => { calls.push(['order', [column, options]]); return builder; },
      limit: async (limit: number) => { calls.push(['limit', limit]); return { data: rows, error: null }; },
    };
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
      from: (table: string) => { calls.push(['from', table]); return builder; },
    };

    await expect(getPreferenceChatMessages(client as never, 'u1')).resolves.toEqual([{
      id: 'm1',
      sender: 'assistant',
      content: 'Saved.',
      createdAt: new Date('2026-07-15T00:00:00.000Z'),
    }]);
    expect(calls).toContainEqual(['select', 'id,sender,content,created_at']);
    expect(calls).toContainEqual(['eq', ['user_id', 'u1']]);
  });

  it('rejects an account switch before reading owner messages', async () => {
    let queried = false;
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: 'u2' } }, error: null }) },
      from: () => { queried = true; },
    };
    await expect(getPreferenceChatMessages(client as never, 'u1')).rejects.toThrow(/Session changed/);
    expect(queried).toBe(false);
  });
});
