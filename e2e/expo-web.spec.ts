import { expect, test, type Page } from '@playwright/test';

const E2E_USER_ID = 'e2e00000-0000-4000-8000-000000000001';

function fakeAccessToken() {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: E2E_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'e2e@example.com',
    exp: 4_102_444_800,
  })}.e2e-signature`;
}

function testUser() {
  const timestamp = '2026-07-19T00:00:00.000Z';
  return {
    id: E2E_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'e2e@example.com',
    email_confirmed_at: timestamp,
    confirmed_at: timestamp,
    last_sign_in_at: timestamp,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { name: 'E2E User' },
    identities: [],
    created_at: timestamp,
    updated_at: timestamp,
    is_anonymous: false,
  };
}

function testProfile(age = 21) {
  const timestamp = '2026-07-19T00:00:00.000Z';
  return {
    id: E2E_USER_ID,
    email: 'e2e@example.com',
    name: 'E2E User',
    age,
    major: 'SE',
    campus: 'HCM',
    avatar_url: '',
    bio: 'Mình thích cà phê và những cuộc trò chuyện chân thành.',
    interests: ['Coffee', 'Music', 'Reading'],
    personality_tags: ['Curious'],
    dating_goals: ['Serious dating'],
    preferred_vibes: ['Deep talks'],
    profile_text: { bio: 'Mình thích cà phê và những cuộc trò chuyện chân thành.' },
    profile_completeness: 100,
    onboarding_source: 'manual',
    ai_signals: {},
    created_at: timestamp,
    updated_at: timestamp,
    gender: 'prefer_not_to_show',
    gender_text: null,
    looking_for_gender: [],
    height_cm: null,
    age_pref_min: null,
    age_pref_max: null,
    appearance_preference: {},
    dealbreakers: [],
    ai_profile_analysis: null,
    profile_confirmed: true,
    onboarding_answers: [],
    onboarding_version: 2,
    profile_revision: 1,
    profile_upgrade_required: false,
    embedding_revision: null,
    embedding_status: 'pending',
  };
}

function revealedPick() {
  return {
    kind: 'revealed',
    id: 'match-e2e-a',
    batchId: 'batch-e2e',
    userId: E2E_USER_ID,
    candidateId: 'candidate-e2e-a',
    candidate: {
      id: 'candidate-e2e-a',
      name: 'An',
      age: 22,
      major: 'AI',
      campus: 'HCM',
      avatarUrl: '',
      bio: 'Thích đọc sách và đi cà phê.',
      interests: ['Coffee', 'Reading'],
      personalityTags: ['Calm'],
      datingGoals: ['Serious dating'],
      preferredVibes: ['Deep talks'],
      profileText: { bio: 'Thích đọc sách và đi cà phê.', school: 'Đại học' },
      profileCompleteness: 100,
      gender: 'prefer_not_to_show',
      heightCm: null,
    },
    pairKey: 'candidate-e2e-a_e2e-user',
    aiReason: 'Hai bạn cùng ưu tiên giao tiếp rõ ràng.',
    compatibilityLabel: 'Tiềm năng mạnh',
    compatibilityScore: 88,
    status: 'pending',
    feedbackTags: [],
    createdAt: '2026-07-19T00:00:00.000Z',
  };
}

function secondRevealedPick() {
  return {
    ...revealedPick(),
    id: 'match-e2e-b',
    candidateId: 'candidate-e2e-b',
    candidate: {
      ...revealedPick().candidate,
      id: 'candidate-e2e-b',
      name: 'Bình',
      bio: 'Thích âm nhạc và những chuyến đi ngắn.',
      profileText: { bio: 'Thích âm nhạc và những chuyến đi ngắn.', school: 'Đại học' },
    },
    pairKey: 'candidate-e2e-b_e2e-user',
    compatibilityLabel: 'Đáng khám phá',
    compatibilityScore: 76,
  };
}

function openDailyResult() {
  return {
    status: 'ready',
    businessDate: '2026-07-19',
    source: 'cached',
    batch: {
      id: 'batch-e2e', userId: E2E_USER_ID, date: '2026-07-19', createdAt: '2026-07-19T00:00:00Z',
      mode: 'open', state: 'unlocked', priceVnd: 100000, lockedCount: 0,
      matches: [revealedPick()],
    },
  };
}

function learningCoursePayload(enrolled: boolean) {
  return {
    id: 'healthy-love-101-v1',
    slug: 'yeu-lanh-manh-101',
    title: 'Yêu lành mạnh 101',
    subtitle: 'Hiểu mình, tôn trọng nhau và trò chuyện an toàn hơn.',
    description: 'Bốn bài học ngắn.',
    durationMinutes: 24,
    lessonCount: 1,
    isFree: true,
    contentVersion: 1,
    sourceLinks: [{ label: 'Nguồn chính thức', url: 'https://example.test/course' }],
    enrollment: enrolled ? {
      status: 'enrolled', progressPercent: 0, currentLesson: 1,
      enrolledAt: '2026-07-19T00:03:00Z', completedAt: null,
    } : null,
    lessons: [{
      id: 'healthy-love-101-signals', position: 1, eyebrow: 'BÀI 1 · NHẬN DIỆN',
      title: 'Một mối quan hệ tốt trông như thế nào?', summary: 'Phân biệt quan tâm và kiểm soát.', durationMinutes: 6,
      contentBlocks: [{ kind: 'lead', title: 'Bình yên không có nghĩa là nhàm chán', body: 'Bạn có thể là chính mình.' }],
      quiz: { question: 'Hành vi nào thể hiện sự tôn trọng?', options: ['Kiểm tra mật khẩu', 'Chấp nhận thời gian riêng'], explanation: 'Tôn trọng ranh giới.' },
      progress: null,
    }],
  };
}

async function installAuthenticatedMocks(page: Page, options: {
  age?: number;
  dailyResult?: object;
  unlockedDailyResult?: object;
  coachResult?: {
    reply: string;
    summary: string;
    preferredTraits: string[];
    avoidedTraits: string[];
  };
  wingmanSuggestions?: [string, string, string];
  emptyConversations?: boolean;
  likedHistory?: object[];
  coachDelayMs?: number;
} = {}) {
  const user = testUser();
  const accessToken = fakeAccessToken();
  const session = {
    access_token: accessToken,
    refresh_token: 'e2e-refresh-token',
    expires_in: 2_147_483_647,
    expires_at: 4_102_444_800,
    token_type: 'bearer',
    user,
  };

  let sharedMessageWrites = 0;
  let unlockCalls = 0;
  let courseEnrollCalls = 0;
  let unlocked = false;
  let courseEnrolled = false;
  const coachRequests: object[] = [];
  let preferenceMessages: object[] = [];
  await page.route(/\/(?:auth|rest|functions)\/v1\//, async route => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.pathname;
    if (path === '/auth/v1/user') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
      return;
    }
    if (path === '/rest/v1/profiles') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(testProfile(options.age)) });
      return;
    }
    if (path === '/rest/v1/preference_chat_messages') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(preferenceMessages) });
      return;
    }
    if (path === '/rest/v1/conversation_participants') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          conversation_id: 'conversation-e2e',
          unread_count: 0,
          conversations: {
            id: 'conversation-e2e',
            updated_at: '2026-07-19T00:01:00Z',
            is_anonymous: false,
          },
        }]),
      });
      return;
    }
    if (path.endsWith('/rpc/list_conversation_summaries')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.emptyConversations ? [] : [{
        conversation_id: 'conversation-e2e', partner_name: 'Mai', partner_avatar_url: '', is_anonymous: false,
        last_message_content: 'Chào, rất vui được làm quen.', last_message_created_at: '2026-07-19T00:01:00Z',
        last_message_is_mine: true, unread_count: 1, updated_at: '2026-07-19T00:01:00Z',
      }]) });
      return;
    }
    if (path.endsWith('/rpc/list_ai_pick_history')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(options.likedHistory ?? []) });
      return;
    }
    if (path.endsWith('/rpc/list_learning_courses')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{
        course_id: 'healthy-love-101-v1', slug: 'yeu-lanh-manh-101', title: 'Yêu lành mạnh 101',
        subtitle: 'Hiểu mình, tôn trọng nhau và trò chuyện an toàn hơn.', description: 'Bốn bài học ngắn.',
        duration_minutes: 24, lesson_count: 4, is_free: true,
        enrollment_status: courseEnrolled ? 'enrolled' : null, progress_percent: 0, current_lesson: 1,
        enrolled_at: courseEnrolled ? '2026-07-19T00:03:00Z' : null, completed_at: null,
      }]) });
      return;
    }
    if (path.endsWith('/rpc/get_learning_course')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(learningCoursePayload(courseEnrolled)) });
      return;
    }
    if (path.endsWith('/rpc/enroll_free_learning_course')) {
      courseEnrollCalls += 1;
      courseEnrolled = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{
        course_id: 'healthy-love-101-v1', enrollment_status: 'enrolled', progress_percent: 0,
        current_lesson: 1, enrolled_at: '2026-07-19T00:03:00Z', applied: courseEnrollCalls === 1,
      }]) });
      return;
    }
    if (path.endsWith('/rpc/list_conversation_messages')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { id: 'message-1', conversation_id: 'conversation-e2e', content: 'Chào bạn!', created_at: '2026-07-19T00:00:00Z', is_read: true, is_mine: false },
        { id: 'message-2', conversation_id: 'conversation-e2e', content: 'Chào, rất vui được làm quen.', created_at: '2026-07-19T00:01:00Z', is_read: true, is_mine: true },
      ]) });
      return;
    }
    if (path.endsWith('/rpc/get_blind_date_session_for_conversation')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }
    if (path.endsWith('/rpc/mark_conversation_read')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
        { conversation_id: 'conversation-e2e', unread_count: 0, marked_read_count: 0, applied: false },
      ]) });
      return;
    }
    if (path.endsWith('/rpc/send_message_atomic')) {
      sharedMessageWrites += 1;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{
        message_id: 'message-sent-e2e', created_at: '2026-07-19T00:04:00Z', applied: true,
      }]) });
      return;
    }
    if (path.endsWith('/rpc/unlock_daily_match_batch')) {
      unlockCalls += 1;
      unlocked = true;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{
        batch_id: 'batch-e2e',
        product_mode: 'stub',
        access_state: 'unlocked',
        price_vnd: 100000,
        applied: true,
        unlock_source: 'simulated',
      }]) });
      return;
    }
    if (path.endsWith('/functions/v1/ensure-daily-matches') && options.dailyResult) {
      const dailyResult = unlocked && options.unlockedDailyResult
        ? options.unlockedDailyResult
        : options.dailyResult;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(dailyResult) });
      return;
    }
    if (path.endsWith('/functions/v1/send-preference-chat-message') && options.coachResult) {
      const requestBody = route.request().postDataJSON() as { content?: unknown };
      coachRequests.push(requestBody);
      const content = typeof requestBody.content === 'string' ? requestBody.content : '';
      preferenceMessages = [
        { id: 'coach-user-1', sender: 'user', content, created_at: '2026-07-19T00:02:00Z' },
        { id: 'coach-assistant-1', sender: 'assistant', content: options.coachResult.reply, created_at: '2026-07-19T00:02:01Z' },
      ];
      if (options.coachDelayMs) await new Promise(resolve => setTimeout(resolve, options.coachDelayMs));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true,
        applied: true,
        fallback: false,
        llmEligible: true,
        ...options.coachResult,
      }) });
      return;
    }
    if (path.endsWith('/functions/v1/ask-conversation-wingman') && options.wingmanSuggestions) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true,
        cached: false,
        suggestions: options.wingmanSuggestions,
      }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  // Expo may load a developer .env during a local export while CI injects its
  // own URL. Discover the compiled project ref instead of hardcoding either.
  await page.goto('/');
  const storageKey = await page.evaluate(async () => {
    const sources = Array.from(document.scripts, script => script.src).filter(Boolean);
    const bundles = await Promise.all(sources.map(source => fetch(source).then(response => response.text())));
    const compiledHost = bundles.join('\n').match(/(?:[a-z0-9-]+\.)?supabase\.co|127\.0\.0\.1/i)?.[0];
    if (!compiledHost) throw new Error('Could not find the compiled Supabase host.');
    return `sb-${compiledHost.split('.')[0]}-auth-token`;
  });
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: storageKey, value: session });
  await page.reload();
  return {
    sharedMessageWrites: () => sharedMessageWrites,
    courseEnrollCalls: () => courseEnrollCalls,
    unlockCalls: () => unlockCalls,
    coachRequests: () => coachRequests,
  };
}

test('unauthenticated visitor can open the login screen from the landing page', async ({ page }) => {
  await page.goto('/');

  const startButton = page.getByText('Bắt đầu miễn phí', { exact: true });
  await expect(startButton).toBeVisible();
  await startButton.click();

  await expect(page).toHaveURL(/\/login\/?$/);
  await expect(page.getByText('Chào mừng trở lại', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('ban@email.com')).toBeVisible();
  await expect(page.getByPlaceholder('••••••••')).toBeVisible();
});

test('landing page presents beta access truthfully without fabricated compatibility breakdowns', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Đang mở miễn phí', { exact: true })).toBeVisible();
  await expect(page.getByText(/Dự kiến 100\.000đ\/batch/)).toBeVisible();
  await expect(page.getByText(/không phải xác suất thành đôi/)).toBeVisible();
  await expect(page.getByText('Giá trị sống', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Tính cách', { exact: true })).toHaveCount(0);
});

test('open AI Picks shows the backend score and label without unlock UI', async ({ page }) => {
  await installAuthenticatedMocks(page, {
    dailyResult: openDailyResult(),
  });
  await page.goto('/');

  await expect(page.getByText('88%', { exact: true })).toBeVisible();
  await expect(page.getByText('Tiềm năng mạnh', { exact: true })).toBeVisible();
  await expect(page.getByText('Hai bạn cùng ưu tiên giao tiếp rõ ràng.', { exact: true })).toBeVisible();
  await expect(page.getByText(/Mở khóa giả lập/)).toHaveCount(0);
  await expect(page.getByText('Giá trị sống', { exact: true })).toHaveCount(0);
});

test('AI Picks dashboard shows several profiles and keeps liked snapshots reviewable', async ({ page }) => {
  await installAuthenticatedMocks(page, {
    dailyResult: {
      ...openDailyResult(),
      batch: { ...openDailyResult().batch, matches: [revealedPick(), secondRevealedPick()] },
    },
    likedHistory: [{
      match_id: 'liked-e2e',
      candidate_snapshot: {
        id: 'candidate-liked', name: 'Chi', age: 23, major: 'Design', campus: 'HCM', avatar_url: '',
        bio: 'Thích triển lãm và những buổi cà phê yên tĩnh.', interests: ['Art', 'Coffee'],
        personality_tags: ['Warm'], dating_goals: ['Serious dating'], preferred_vibes: ['Kind'],
        profile_text: { bio: 'Thích triển lãm và những buổi cà phê yên tĩnh.', school: 'FPT University' },
        profile_completeness: 100,
      },
      ai_reason: 'Hai bạn cùng trân trọng sự sáng tạo.', suggested_opener: null,
      compatibility_label: 'Rất hợp gu', compatibility_score: 86,
      match_status: 'accepted', liked_at: '2026-07-19T00:02:00Z',
    }],
  });
  await page.goto('/');

  await expect(page.getByText('DASHBOARD HÔM NAY', { exact: true })).toBeVisible();
  await expect(page.getByText('An, 22', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Bình, 22', { exact: true }).first()).toBeVisible();
  await page.getByText(/Đã thích \(1\)/).click();
  await expect(page.getByText('Chi, 23', { exact: true })).toBeVisible();
  await page.getByText('Chi, 23', { exact: true }).click();
  await expect(page.getByText('Hai bạn cùng trân trọng sự sáng tạo.', { exact: true })).toBeVisible();
  await expect(page.getByText(/không phải xác suất thành đôi/)).toBeVisible();
});

test('stub AI Picks previews the real locked count and invalidates after simulated unlock', async ({ page }) => {
  const initialResult = {
    status: 'ready',
    businessDate: '2026-07-19',
    source: 'generated',
    batch: {
      id: 'batch-e2e', userId: E2E_USER_ID, date: '2026-07-19', createdAt: '2026-07-19T00:00:00Z',
      mode: 'stub', state: 'teaser', priceVnd: 100000, lockedCount: 1,
      matches: [
        revealedPick(),
        { kind: 'locked', previewId: '019-preview-e2e', compatibilityScore: 76, compatibilityLabel: 'Đáng khám phá' },
      ],
    },
  };
  const mocks = await installAuthenticatedMocks(page, {
    dailyResult: initialResult,
    unlockedDailyResult: {
      ...initialResult,
      source: 'cached',
      batch: {
        ...initialResult.batch,
        state: 'unlocked',
        lockedCount: 0,
        matches: [revealedPick(), secondRevealedPick()],
      },
    },
  });
  await page.goto('/');

  await expect(page.getByText('1 gợi ý đang khóa', { exact: true })).toBeVisible();
  await expect(page.getByText('76%', { exact: true })).toBeVisible();
  await expect(page.getByText(/Mở khóa giả lập · 100\.000đ\/batch/)).toBeVisible();
  await expect(page.getByText(/không tiết lộ danh tính/)).toBeVisible();

  await page.getByText(/Mở khóa giả lập · 100\.000đ\/batch/).click();
  await expect(page.getByText('Mở khóa bản demo?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Xác nhận mở khóa giả lập' }).click();
  await expect(page.getByText('1 gợi ý đang khóa', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Gợi ý hôm nay · 2 người còn lại', { exact: true })).toBeVisible();
  expect(mocks.unlockCalls()).toBe(1);
});

test('under-18 Coach explains deterministic preference-only mode', async ({ page }) => {
  await installAuthenticatedMocks(page, { age: 17, dailyResult: openDailyResult() });
  await page.goto('/');
  await page.getByLabel('Mở F-Love AI Coach').click();

  await expect(page.getByText('F-Love AI Coach', { exact: true })).toBeVisible();
  await expect(page.getByText('Chế độ bảo vệ người dùng dưới 18 tuổi', { exact: true })).toBeVisible();
  await expect(page.getByText(/không gửi nội dung cho mô hình AI/)).toBeVisible();
});

test('AI Coach finalizes a preference turn and refreshes the private transcript', async ({ page }) => {
  const coachReply = 'Mình đã ghi nhớ rằng bạn ưu tiên giao tiếp rõ ràng.';
  const mocks = await installAuthenticatedMocks(page, {
    dailyResult: openDailyResult(),
    coachDelayMs: 450,
    coachResult: {
      reply: coachReply,
      summary: 'Ưu tiên giao tiếp rõ ràng.',
      preferredTraits: ['giao tiếp rõ ràng'],
      avoidedTraits: [],
    },
  });
  await page.goto('/');
  await page.getByLabel('Mở F-Love AI Coach').click();

  const message = 'Mình ưu tiên người giao tiếp rõ ràng';
  await page.getByLabel('Lời nhắn cho F-Love AI Coach').fill(message);
  await page.getByLabel('Gửi cho F-Love AI Coach').click();
  await expect(page.getByText(message, { exact: true })).toBeVisible();
  await expect(page.getByText('Coach đang suy nghĩ…', { exact: true })).toBeVisible();
  await expect(page.getByText(coachReply, { exact: true })).toBeVisible();
  const composerWidth = await page.getByLabel('Lời nhắn cho F-Love AI Coach').evaluate(element => element.getBoundingClientRect().width);
  expect(composerWidth).toBeLessThanOrEqual(780);
  expect(mocks.coachRequests()).toHaveLength(1);
  expect(mocks.coachRequests()[0]).toMatchObject({ content: message, expectedUserId: E2E_USER_ID });
});

test('new users receive a clearly labelled local chat tutorial', async ({ page }) => {
  const mocks = await installAuthenticatedMocks(page, { dailyResult: openDailyResult(), emptyConversations: true });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Tin nhắn' }).click();

  await expect(page.getByText('HƯỚNG DẪN', { exact: true })).toBeVisible();
  await page.getByLabel('Mở cuộc trò chuyện hướng dẫn').click();
  await expect(page).toHaveURL(/\/chat-tutorial\/?$/);
  await expect(page.getByText(/không phải người dùng thật/)).toBeVisible();
  const suggestion = 'Điều gì gần đây làm bạn vui nhất?';
  await page.getByText(suggestion, { exact: true }).click();
  await expect(page.getByLabel('Tin nhắn hướng dẫn')).toHaveValue(suggestion);
  await page.getByLabel('Gửi tin nhắn mẫu').click();
  await expect(page.getByText(suggestion, { exact: true }).last()).toBeVisible();
  expect(mocks.sharedMessageWrites()).toBe(0);
});

test('relationship course replaces Blind Date and creates one real free enrollment', async ({ page }) => {
  const mocks = await installAuthenticatedMocks(page, { dailyResult: openDailyResult() });
  await page.goto('/');

  await expect(page.getByRole('tab', { name: 'Blind Date' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Khóa học' }).click();
  await expect(page.getByText('Yêu lành mạnh 101', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đăng ký miễn phí' }).click();
  await expect(page).toHaveURL(/\/course\/yeu-lanh-manh-101/);
  await expect(page.getByText('Một mối quan hệ tốt trông như thế nào?', { exact: true }).first()).toBeVisible();
  expect(mocks.courseEnrollCalls()).toBe(1);
});

test('Wingman suggestions fill the composer without writing a shared message', async ({ page }) => {
  const mocks = await installAuthenticatedMocks(page, {
    dailyResult: openDailyResult(),
    wingmanSuggestions: ['Bạn thường thích đi cà phê ở đâu?', 'Cuối tuần này bạn có kế hoạch gì vui không?', 'Mình cũng thích đọc sách, bạn đang đọc cuốn nào?'],
  });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Tin nhắn' }).click();
  await page.getByText('Mai', { exact: true }).click();
  await expect(page).toHaveURL(/\/chat\/conversation-e2e\/?$/);
  await page.getByLabel('Mở Wingman').click();

  const suggestion = 'Bạn thường thích đi cà phê ở đâu?';
  await expect(page.getByText('Chỉ mình bạn thấy', { exact: true })).toBeVisible();
  await expect(page.getByText(suggestion, { exact: true })).toBeVisible();
  await page.getByText(suggestion, { exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Nhắn tin...' })).toHaveValue(suggestion);
  expect(mocks.sharedMessageWrites()).toBe(0);
  await expect(page.getByText('Chào bạn!', { exact: true })).toBeVisible();
});

test('chat widget uses the shared atomic send path and stays synchronized with inbox data', async ({ page }) => {
  const mocks = await installAuthenticatedMocks(page, { dailyResult: openDailyResult() });
  await page.goto('/');

  await page.getByLabel('Mở chat nhanh').click();
  await expect(page.getByText('Tin nhắn gần đây', { exact: true })).toBeVisible();
  await page.getByText('Mai', { exact: true }).click();
  await page.getByLabel('Nhắn tin nhanh').fill('Hẹn bạn một buổi cà phê nhé?');
  await page.getByLabel('Gửi tin nhắn nhanh').click();
  await expect(page.getByLabel('Nhắn tin nhanh')).toHaveValue('');
  expect(mocks.sharedMessageWrites()).toBe(1);
});
