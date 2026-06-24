import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const env = {};
for (const line of readFileSync(resolve('apps/app/.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const client = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { error: signInError } = await client.auth.signInWithPassword({ email: 'linh.tran@fpt.edu.vn', password: 'FloveMock123!' });
if (signInError) throw signInError;

const answers = [
  { questionId: 'need_chips', value: ['Mối quan hệ nghiêm túc'] },
  { questionId: 'need_text', value: 'Mình tìm người nghiêm túc, bắt đầu nhẹ nhàng rồi lâu dài.' },
  { questionId: 'self_chips', value: ['Hướng nội', 'Thích chill'] },
  { questionId: 'self_text', value: 'Mình hơi hướng nội, thích cà phê yên tĩnh, đọc sách và trò chuyện sâu.' },
  { questionId: 'attraction_text', value: 'Mình thích người có định hướng, biết lắng nghe, nói chuyện có chiều sâu.' },
  { questionId: 'appearance_importance', value: 'soft' },
  { questionId: 'appearance_specifics', value: '' },
  { questionId: 'communication_text', value: 'Mình thích nhắn ít nhưng sâu, không áp lực rep nhanh.' },
  { questionId: 'boundaries_chips', value: ['Nói chuyện hời hợt'] },
  { questionId: 'boundaries_text', value: 'Mình không thích sự hời hợt và thiếu trung thực.' },
];
const basic = { name: 'Test', age: 20, gender: 'female', lookingForGender: ['male'], heightCm: 162, school: 'FPT', majorLabel: 'AI', major: 'AI', campus: 'HCM' };

console.log('Invoking analyze-onboarding-profile...');
const { data, error } = await client.functions.invoke('analyze-onboarding-profile', { body: { answers, basic } });
if (error) {
  console.error('ERROR:', error.name, error.message);
  const body = await error.context?.text?.().catch(() => '');
  console.error('BODY:', body);
} else {
  console.log('OK. generatedBy =', data?.generatedBy);
  console.log('has analysis =', Boolean(data?.analysis), '| has aiReview =', Boolean(data?.analysis?.aiReview));
  console.log('aiReview.selfSummary =', data?.analysis?.aiReview?.selfSummary?.slice(0, 80));
}
