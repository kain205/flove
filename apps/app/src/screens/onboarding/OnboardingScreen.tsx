import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { signOut } from '@/services/auth';
import { loadCurrentProfile, profileQueryKey } from '@/services/profile';
import { uploadAvatar } from '@/services/photos';
import { supabase } from '@/lib/supabase';
import {
  analyzeOnboardingProfile,
  confirmOnboardingProfile,
  getOnboardingDraft,
  saveOnboardingDraft,
  type OnboardingAnswerInput,
  type OnboardingBasicInput,
} from '@flove/supabase';
import { colors, fonts, gradients, radii } from '@/theme';
import {
  ONBOARDING_VERSION,
  overlayProfileOnOnboardingDraft,
  type AIProfileAnalysis,
  type Campus,
  type Major,
  type OnboardingDraftV2,
  type OnboardingReviewEdits,
  type UserProfile,
} from '@flove/core';
import { useAuth } from '@/providers/AuthProvider';
import logoImage from '../../assets/logo.png';

const wideBreakpoint = 900;
const reviewStep = 6;

const schoolOptions: Array<{ label: string; campus: Campus }> = [
  { label: 'Đại học Bách khoa Hà Nội (HUST)', campus: 'Hanoi' },
  { label: 'Đại học Kinh tế Quốc dân (NEU)', campus: 'Hanoi' },
  { label: 'Đại học Ngoại thương (FTU)', campus: 'Hanoi' },
  { label: 'Đại học Công nghệ - ĐHQGHN (UET)', campus: 'Hanoi' },
  { label: 'Đại học Khoa học Tự nhiên - ĐHQGHN', campus: 'Hanoi' },
  { label: 'Đại học KHXH&NV - ĐHQGHN', campus: 'Hanoi' },
  { label: 'Đại học FPT Hà Nội', campus: 'Hanoi' },
  { label: 'Học viện Công nghệ Bưu chính Viễn thông (PTIT)', campus: 'Hanoi' },
  { label: 'Học viện Ngân hàng', campus: 'Hanoi' },
  { label: 'Học viện Tài chính', campus: 'Hanoi' },
  { label: 'Đại học Thương mại', campus: 'Hanoi' },
  { label: 'Đại học Hà Nội', campus: 'Hanoi' },
  { label: 'Đại học Xây dựng Hà Nội', campus: 'Hanoi' },
  { label: 'Đại học Giao thông Vận tải', campus: 'Hanoi' },
  { label: 'Đại học Y Hà Nội', campus: 'Hanoi' },
  { label: 'Đại học Dược Hà Nội', campus: 'Hanoi' },
  { label: 'Đại học Sư phạm Hà Nội', campus: 'Hanoi' },
  { label: 'Đại học Mỏ Địa chất', campus: 'Hanoi' },
  { label: 'Đại học Điện lực', campus: 'Hanoi' },
  { label: 'Đại học Công nghiệp Hà Nội', campus: 'Hanoi' },
  { label: 'Đại học Bách khoa TP. Hồ Chí Minh', campus: 'HCM' },
  { label: 'Đại học CNTT TP.HCM (UIT)', campus: 'HCM' },
  { label: 'Đại học Khoa học Tự nhiên TP. Hồ Chí Minh', campus: 'HCM' },
  { label: 'Đại học Kinh tế TP.HCM (UEH)', campus: 'HCM' },
  { label: 'Đại học Ngoại thương CS2', campus: 'HCM' },
  { label: 'Đại học FPT TP.HCM', campus: 'HCM' },
  { label: 'Đại học Tôn Đức Thắng', campus: 'HCM' },
  { label: 'Đại học Công nghiệp TP.HCM', campus: 'HCM' },
  { label: 'Đại học Sư phạm Kỹ thuật TP.HCM', campus: 'HCM' },
  { label: 'Đại học Sài Gòn', campus: 'HCM' },
  { label: 'Đại học Mở TP.HCM', campus: 'HCM' },
  { label: 'Đại học Ngân hàng TP.HCM', campus: 'HCM' },
  { label: 'Đại học Y Dược TP.HCM', campus: 'HCM' },
  { label: 'Đại học Luật TP.HCM', campus: 'HCM' },
  { label: 'Đại học Quốc tế (IU)', campus: 'HCM' },
  { label: 'Đại học Kinh tế - Luật (UEL)', campus: 'HCM' },
  { label: 'Đại học Bách khoa Đà Nẵng', campus: 'Danang' },
  { label: 'Đại học Kinh tế Đà Nẵng', campus: 'Danang' },
  { label: 'Đại học Sư phạm Đà Nẵng', campus: 'Danang' },
  { label: 'Đại học CNTT & Truyền thông Việt Hàn', campus: 'Danang' },
  { label: 'Đại học Duy Tân', campus: 'Danang' },
  { label: 'Đại học FPT Đà Nẵng', campus: 'Danang' },
  { label: 'Đại học Cần Thơ', campus: 'Cantho' },
  { label: 'Đại học FPT Cần Thơ', campus: 'Cantho' },
  { label: 'Đại học Y Dược Cần Thơ', campus: 'Cantho' },
  { label: 'Đại học Nha Trang', campus: 'Danang' },
  { label: 'Đại học Quy Nhơn', campus: 'Danang' },
  { label: 'Đại học Vinh', campus: 'Hanoi' },
  { label: 'Đại học Huế', campus: 'Danang' },
  { label: 'Đại học Thái Nguyên', campus: 'Hanoi' },
  { label: 'Đại học Phenikaa', campus: 'Hanoi' },
  { label: 'Đại học Văn Lang', campus: 'HCM' },
  { label: 'Đại học Hoa Sen', campus: 'HCM' },
  { label: 'Đại học RMIT Việt Nam', campus: 'HCM' },
  { label: 'Đại học Greenwich Việt Nam', campus: 'HCM' },
  { label: 'Đại học HUTECH', campus: 'HCM' },
  { label: 'Đại học UEF', campus: 'HCM' },
  { label: 'Đại học Công nghệ TP.HCM', campus: 'HCM' },
];

const majorOptions: Array<{ label: string; major: Major }> = [
  { label: 'Trí tuệ nhân tạo (AI)', major: 'AI' },
  { label: 'Khoa học máy tính', major: 'SE' },
  { label: 'Công nghệ thông tin', major: 'SE' },
  { label: 'Kỹ thuật phần mềm', major: 'SE' },
  { label: 'An toàn thông tin', major: 'SE' },
  { label: 'Khoa học dữ liệu', major: 'AI' },
  { label: 'Điện - Điện tử', major: 'SE' },
  { label: 'Cơ điện tử', major: 'SE' },
  { label: 'Tự động hóa', major: 'SE' },
  { label: 'Cơ khí', major: 'SE' },
  { label: 'Xây dựng', major: 'SE' },
  { label: 'Kinh tế', major: 'Biz' },
  { label: 'Quản trị kinh doanh', major: 'Biz' },
  { label: 'Marketing', major: 'Marketing' },
  { label: 'Tài chính', major: 'Biz' },
  { label: 'Kế toán', major: 'Biz' },
  { label: 'Ngân hàng', major: 'Biz' },
  { label: 'Logistics', major: 'Biz' },
  { label: 'Luật', major: 'Biz' },
  { label: 'Y khoa', major: 'Biz' },
  { label: 'Dược', major: 'Biz' },
  { label: 'Điều dưỡng', major: 'Biz' },
  { label: 'Tâm lý học', major: 'Biz' },
  { label: 'Giáo dục', major: 'Biz' },
  { label: 'Ngôn ngữ Anh', major: 'Biz' },
  { label: 'Ngôn ngữ Trung', major: 'Biz' },
  { label: 'Ngôn ngữ Nhật', major: 'Biz' },
  { label: 'Quan hệ quốc tế', major: 'Biz' },
  { label: 'Thiết kế đồ họa', major: 'Design' },
  { label: 'Truyền thông đa phương tiện', major: 'Marketing' },
  { label: 'Báo chí', major: 'Marketing' },
  { label: 'Kiến trúc', major: 'Design' },
  { label: 'Du lịch', major: 'Biz' },
  { label: 'Khách sạn', major: 'Biz' },
  { label: 'Nông nghiệp', major: 'Biz' },
  { label: 'Công nghệ thực phẩm', major: 'SE' },
  { label: 'Khác', major: 'Biz' },
];

const genderOptions = [
  { token: 'female', label: 'Nữ' },
  { token: 'male', label: 'Nam' },
  { token: 'other', label: 'Khác / muốn tự mô tả' },
  { token: 'prefer_not_to_show', label: 'Không muốn hiển thị' },
];
const lookingForOptions = [
  { token: 'male', label: 'Nam' },
  { token: 'female', label: 'Nữ' },
  { token: 'everyone', label: 'Mọi giới' },
  { token: 'depends', label: 'Tùy mục đích' },
];
const importanceOptions = [
  { token: 'none', label: 'Không quan trọng lắm' },
  { token: 'soft', label: 'Có một chút' },
  { token: 'medium', label: 'Khá quan trọng' },
  { token: 'hard', label: 'Rất quan trọng' },
];
const needChipOptions = ['Bạn mới', 'Người cùng sở thích', 'Người học/làm dự án cùng', 'Hẹn hò nhẹ nhàng', 'Mối quan hệ nghiêm túc', 'Chưa biết, muốn khám phá'];
const selfHintChips = ['Hướng nội', 'Năng động', 'Thích học cái mới', 'Thích chill', 'Thích đi chơi', 'Thích game/phim/nhạc', 'Thích làm project', 'Thích nói chuyện sâu'];
const boundaryChipOptions = ['Nói chuyện hời hợt', 'Không tôn trọng ranh giới', 'Quá party', 'Không rõ mục tiêu', 'Hút thuốc', 'Lệch intent', 'Ít chủ động', 'Quá kiểm soát'];

const exploreChip = 'Chưa biết, muốn khám phá';

interface NotebookDraft {
  name: string;
  age: string;
  gender: string;
  genderText: string;
  lookingFor: string[];
  school: string;
  campus: Campus;
  major: Major;
  majorLabel: string;
  heightCm: string;
  agePrefMin: number | null;
  agePrefMax: number | null;
  avatarUrl: string;
  needChips: string[];
  needText: string;
  selfChips: string[];
  selfText: string;
  attractionText: string;
  appearanceImportance: string;
  appearanceSpecifics: string;
  communicationText: string;
  boundaryChips: string[];
  boundaryText: string;
  boundaryUnsure: boolean;
}

const emptyDraft: NotebookDraft = {
  name: '', age: '', gender: '', genderText: '', lookingFor: [],
  school: '', campus: 'HCM', major: 'SE', majorLabel: '', heightCm: '', agePrefMin: null, agePrefMax: null, avatarUrl: '',
  needChips: [], needText: '', selfChips: [], selfText: '',
  attractionText: '', appearanceImportance: 'none', appearanceSpecifics: '',
  communicationText: '', boundaryChips: [], boundaryText: '', boundaryUnsure: false,
};

type ReviewEdits = OnboardingReviewEdits;

const emptyReviewEdits: ReviewEdits = {
  selfSummary: '',
  seekingSummary: '',
  idealMatchSummary: '',
  avoidSummary: '',
  suggestedBio: '',
};

const stepMetas = [
  { icon: '🧡', title: 'Bắt đầu với bạn', subtitle: 'F-Love cần vài thông tin cơ bản để gợi ý đúng người hơn.' },
  { icon: '💬', title: 'Bạn đang tìm điều gì ở F-Love?', subtitle: 'Điều này giúp F-Love tránh ghép lệch mục tiêu.' },
  { icon: '🌙', title: 'Kể F-Love nghe về bạn', subtitle: 'Không cần viết hoàn hảo. Cứ viết như đang giới thiệu bản thân với một người mới.' },
  { icon: '✨', title: 'Gu thu hút của bạn', subtitle: 'F-Love không chấm điểm ngoại hình. Phần này chỉ giúp hiểu gu của bạn tinh tế hơn.' },
  { icon: '💌', title: 'Bạn thích nói chuyện kiểu nào?', subtitle: 'Match tốt không chỉ là hợp sở thích, mà còn là nói chuyện có tự nhiên không.' },
  { icon: '🚧', title: 'Điều gì khiến bạn thấy không hợp?', subtitle: 'Phần này giúp F-Love tránh gợi ý lệch gu hoặc làm bạn khó chịu.' },
  { icon: '🎉', title: 'F-Love hiểu bạn như thế này', subtitle: 'Bạn có thể sửa lại nếu AI hiểu chưa đúng.' },
];

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function filteredOptions<T extends { label: string }>(options: T[], query: string) {
  const normalized = normalizeSearch(query);
  if (!normalized) return options.slice(0, 8);
  return options.filter(option => normalizeSearch(option.label).includes(normalized)).slice(0, 10);
}

function inferCampusFromSchool(school: string): Campus {
  const exact = schoolOptions.find(option => normalizeSearch(option.label) === normalizeSearch(school));
  if (exact) return exact.campus;
  const normalized = normalizeSearch(school);
  if (normalized.includes('da nang') || normalized.includes('duy tan') || normalized.includes('hue') || normalized.includes('nha trang') || normalized.includes('quy nhon')) return 'Danang';
  if (normalized.includes('can tho')) return 'Cantho';
  if (normalized.includes('hcm') || normalized.includes('tp.hcm') || normalized.includes('sai gon') || normalized.includes('rmit') || normalized.includes('van lang') || normalized.includes('hoa sen') || normalized.includes('hutech') || normalized.includes('uef')) return 'HCM';
  return 'Hanoi';
}

function inferMajorFromLabel(label: string): Major {
  const exact = majorOptions.find(option => normalizeSearch(option.label) === normalizeSearch(label));
  if (exact) return exact.major;
  const normalized = normalizeSearch(label);
  if (normalized.includes('ai') || normalized.includes('tri tue') || normalized.includes('du lieu')) return 'AI';
  if (normalized.includes('marketing') || normalized.includes('truyen thong') || normalized.includes('bao chi')) return 'Marketing';
  if (normalized.includes('thiet ke') || normalized.includes('kien truc')) return 'Design';
  if (normalized.includes('cong nghe') || normalized.includes('may tinh') || normalized.includes('phan mem') || normalized.includes('an toan') || normalized.includes('dien') || normalized.includes('co khi')) return 'SE';
  return 'Biz';
}

function answerValue(answers: OnboardingAnswerInput[], questionId: string): string | string[] | undefined {
  return answers.find(answer => answer.questionId === questionId)?.value;
}

function answerTextValue(answers: OnboardingAnswerInput[], questionId: string): string {
  const value = answerValue(answers, questionId);
  return Array.isArray(value) ? value.join(', ') : value ?? '';
}

function answerListValue(answers: OnboardingAnswerInput[], questionId: string): string[] {
  const value = answerValue(answers, questionId);
  return Array.isArray(value) ? value : value ? [value] : [];
}

function notebookFromPayload(payload: OnboardingDraftV2): NotebookDraft {
  const { basic, answers } = payload;
  return {
    ...emptyDraft,
    name: basic.name ?? '',
    age: basic.age ? String(basic.age) : '',
    gender: basic.gender ?? '',
    genderText: basic.genderText ?? '',
    lookingFor: basic.lookingForGender ?? [],
    school: basic.school ?? '',
    campus: (basic.campus as Campus | undefined) ?? 'HCM',
    major: (basic.major as Major | undefined) ?? 'SE',
    majorLabel: basic.majorLabel ?? '',
    heightCm: basic.heightCm ? String(basic.heightCm) : '',
    agePrefMin: basic.agePrefMin ?? null,
    agePrefMax: basic.agePrefMax ?? null,
    avatarUrl: basic.avatarUrl ?? '',
    needChips: answerListValue(answers, 'need_chips'),
    needText: answerTextValue(answers, 'need_text'),
    selfChips: answerListValue(answers, 'self_chips'),
    selfText: answerTextValue(answers, 'self_text'),
    attractionText: answerTextValue(answers, 'attraction_text'),
    appearanceImportance: answerTextValue(answers, 'appearance_importance') || 'none',
    appearanceSpecifics: answerTextValue(answers, 'appearance_specifics'),
    communicationText: answerTextValue(answers, 'communication_text'),
    boundaryChips: answerListValue(answers, 'boundaries_chips'),
    boundaryText: answerTextValue(answers, 'boundaries_text'),
    boundaryUnsure: answerTextValue(answers, 'boundaries_unsure') === 'true',
  };
}

function profileDraft(profile: UserProfile | null | undefined): OnboardingDraftV2 {
  const legacyAnalysis = profile?.aiProfileAnalysis;
  const legacySignals = legacyAnalysis?.matchingSignals;
  const legacyAnswers: OnboardingAnswerInput[] = [
    { questionId: 'need_chips', value: legacySignals?.intents ?? profile?.datingGoals ?? [] },
    { questionId: 'need_text', value: legacyAnalysis?.aiReview?.seekingSummary ?? '' },
    { questionId: 'self_chips', value: legacySignals?.selfTraits ?? profile?.personalityTags ?? [] },
    { questionId: 'self_text', value: profile?.profileText.bio || profile?.bio || legacyAnalysis?.aiReview?.selfSummary || '' },
    { questionId: 'attraction_text', value: legacyAnalysis?.aiReview?.idealMatchSummary ?? '' },
    { questionId: 'appearance_importance', value: legacySignals?.appearancePreference?.importance ?? 'none' },
    { questionId: 'appearance_specifics', value: [
      ...(legacySignals?.appearancePreference?.preferredStyleTags ?? []),
      ...(legacySignals?.appearancePreference?.preferredAppearanceVibeTags ?? []),
    ].join(', ') },
    { questionId: 'communication_text', value: legacyAnalysis?.publicProfile?.conversationHooks?.join('. ') ?? '' },
    { questionId: 'boundaries_chips', value: legacySignals?.dealbreakers?.flatMap(item => item?.trait ? [item.trait] : []) ?? [] },
    { questionId: 'boundaries_text', value: legacyAnalysis?.aiReview?.avoidSummary ?? '' },
    { questionId: 'boundaries_unsure', value: legacySignals?.dealbreakers?.length ? 'false' : 'true' },
  ];
  return {
    version: ONBOARDING_VERSION,
    step: 0,
    basic: {
      name: profile?.name ?? '',
      age: profile?.age || undefined,
      gender: profile?.gender ?? '',
      genderText: profile?.genderText ?? '',
      lookingForGender: profile?.lookingForGender ?? [],
      school: profile?.profileText.school ?? '',
      campus: profile?.campus ?? 'HCM',
      major: profile?.major ?? 'SE',
      majorLabel: profile?.profileText.majorLabel ?? '',
      heightCm: profile?.heightCm ?? null,
      avatarUrl: profile?.avatarUrl ?? '',
      agePrefMin: profile?.agePref?.min ?? null,
      agePrefMax: profile?.agePref?.max ?? null,
    },
    answers: profile?.onboardingAnswers?.length ? profile.onboardingAnswers : legacyAnswers,
  };
}

function reviewFromAnalysis(analysis: AIProfileAnalysis): ReviewEdits {
  return {
    selfSummary: analysis.aiReview.selfSummary ?? '',
    seekingSummary: analysis.aiReview.seekingSummary ?? '',
    idealMatchSummary: analysis.aiReview.idealMatchSummary ?? '',
    avoidSummary: analysis.aiReview.avoidSummary ?? '',
    suggestedBio: analysis.aiReview.suggestedBio ?? '',
  };
}

function longTextHelper(text: string, min: number) {
  const remaining = min - text.trim().length;
  return remaining > 0 ? `Còn ${remaining} ký tự nữa (tối thiểu ${min})` : `Đủ rồi — tối thiểu ${min} ký tự`;
}

function StepIcon({ emoji, size = 46 }: { emoji: string; size?: number }) {
  return (
    <View style={[styles.stepIcon, { width: size, height: size, borderRadius: size * 0.3 }]}>
      <Text style={{ fontSize: size * 0.46 }}>{emoji}</Text>
    </View>
  );
}

function ChipButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function Segmented({ options, selected, onSelect }: { options: Array<{ token: string; label: string }>; selected: (token: string) => boolean; onSelect: (token: string) => void }) {
  return (
    <View style={styles.segmentWrap}>
      {options.map(option => (
        <Pressable key={option.token} accessibilityRole="button" onPress={() => onSelect(option.token)} style={({ pressed }) => [styles.segment, selected(option.token) && styles.segmentOn, pressed && styles.pressed]}>
          <Text style={[styles.segmentText, selected(option.token) && styles.segmentTextOn]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function FloatingHeart({ left, right, top, bottom, size, delay }: { left?: number; right?: number; top?: number; bottom?: number; size: number; delay: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 3200, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, delay]);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.85] });
  return <Animated.Text pointerEvents="none" style={[styles.heart, { left, right, top, bottom, fontSize: size, opacity, transform: [{ translateY }] }]}>♥</Animated.Text>;
}

function SearchableDropdown<T extends { label: string }>({
  label, value, placeholder, options, onChangeText, onSelect,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: T[];
  onChangeText: (text: string) => void;
  onSelect: (option: T) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const matches = filteredOptions(options, value);
  return (
    <View style={styles.dropdownBlock}>
      <TextField label={label} value={value} onFocus={() => setIsOpen(true)} onChangeText={text => { onChangeText(text); setIsOpen(true); }} placeholder={placeholder} />
      {isOpen ? (
        <View style={styles.dropdownMenu}>
          {matches.length > 0 ? matches.map(option => (
            <Pressable key={option.label} accessibilityRole="button" onPress={() => { onSelect(option); setIsOpen(false); }} style={({ pressed }) => [styles.dropdownItem, value === option.label && styles.dropdownItemSelected, pressed && styles.pressed]}>
              <Text style={[styles.dropdownItemText, value === option.label && styles.dropdownItemTextSelected]}>{option.label}</Text>
            </Pressable>
          )) : (
            <View style={styles.dropdownItem}><Text style={styles.dropdownItemText}>Không tìm thấy lựa chọn phù hợp</Text></View>
          )}
        </View>
      ) : null}
    </View>
  );
}

export function OnboardingScreen() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const params = useLocalSearchParams<{ mode?: string }>();
  const profileKey = profileQueryKey(userId);
  const onboardingDraftKey = ['onboarding-draft', userId ?? 'anonymous'] as const;
  const profileQuery = useQuery({
    queryKey: profileKey,
    queryFn: () => loadCurrentProfile(userId),
    enabled: Boolean(userId),
  });
  const persistedDraftQuery = useQuery({
    queryKey: onboardingDraftKey,
    queryFn: () => getOnboardingDraft(supabase, userId),
    enabled: Boolean(userId),
    retry: 1,
  });
  const { width } = useWindowDimensions();
  const isWide = width >= wideBreakpoint;
  const isEditMode = params.mode === 'edit';

  const [draft, setDraft] = useState<NotebookDraft>(emptyDraft);
  const [hydrated, setHydrated] = useState(false);
  const [draftRevision, setDraftRevision] = useState(0);
  const [analysisRevision, setAnalysisRevision] = useState<number | null>(null);
  const [autosaveError, setAutosaveError] = useState('');
  const [isAutosaving, setIsAutosaving] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [stepError, setStepError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [analysis, setAnalysis] = useState<AIProfileAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [reviewEdits, setReviewEdits] = useState<ReviewEdits>(emptyReviewEdits);
  const anim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const revisionRef = useRef(0);
  const lastSavedFingerprintRef = useRef('');
  const analysisDraftFingerprintRef = useRef('');
  const saveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeUserIdRef = useRef(userId);
  const previousUserIdRef = useRef(userId);
  activeUserIdRef.current = userId;

  useEffect(() => {
    if (previousUserIdRef.current === userId) return;
    previousUserIdRef.current = userId;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = null;
    revisionRef.current = 0;
    lastSavedFingerprintRef.current = '';
    analysisDraftFingerprintRef.current = '';
    saveQueueRef.current = Promise.resolve();
    setDraft(emptyDraft);
    setStep(0);
    setDir(1);
    setDraftRevision(0);
    setAnalysisRevision(null);
    setAnalysis(null);
    setReviewEdits(emptyReviewEdits);
    setAutosaveError('');
    setAnalysisError('');
    setStepError('');
    setIsAutosaving(false);
    setAnalyzing(false);
    setIsSaving(false);
    setUploadingAvatar(false);
    setShowDone(false);
    setHydrated(false);
    anim.stopAnimation();
    anim.setValue(1);
    progressAnim.stopAnimation();
    progressAnim.setValue(0);
  }, [anim, progressAnim, userId]);

  useEffect(() => {
    if (hydrated || profileQuery.isLoading || persistedDraftQuery.isLoading) return;
    if ((profileQuery.isError && !profileQuery.data) || (persistedDraftQuery.isError && !persistedDraftQuery.data)) return;
    const persisted = persistedDraftQuery.data;
    const profile = profileQuery.data;
    let payload = persisted?.draft ?? profileDraft(profile);
    const profileIsAtLeastAsRecent = profile && (
      !persisted
      || !profile.updatedAt
      || profile.updatedAt.getTime() >= persisted.updatedAt.getTime()
    );
    if (isEditMode && persisted && profileIsAtLeastAsRecent) {
      payload = overlayProfileOnOnboardingDraft(payload, profile);
    }
    const nextDraft = notebookFromPayload(payload);
    setDraft(nextDraft);
    const nextRevision = persisted?.draftRevision ?? 0;
    revisionRef.current = nextRevision;
    setDraftRevision(nextRevision);
    lastSavedFingerprintRef.current = persisted ? JSON.stringify(persisted.draft) : '';
    setStep(isEditMode ? 0 : payload.step);
    if (persisted?.analysis && persisted.analysisRevision === persisted.draftRevision && !isEditMode) {
      setAnalysis(persisted.analysis);
      setAnalysisRevision(persisted.analysisRevision);
      setReviewEdits(reviewFromAnalysis(persisted.analysis));
      analysisDraftFingerprintRef.current = JSON.stringify(nextDraft);
    }
    setHydrated(true);
  }, [hydrated, isEditMode, persistedDraftQuery.data, persistedDraftQuery.isError, persistedDraftQuery.isLoading, profileQuery.data, profileQuery.isError, profileQuery.isLoading]);

  const buildAnswers = (value = draft): OnboardingAnswerInput[] => [
    { questionId: 'need_chips', value: value.needChips },
    { questionId: 'need_text', value: value.needText.trim() },
    { questionId: 'self_chips', value: value.selfChips },
    { questionId: 'self_text', value: value.selfText.trim() },
    { questionId: 'attraction_text', value: value.attractionText.trim() },
    { questionId: 'appearance_importance', value: value.appearanceImportance },
    { questionId: 'appearance_specifics', value: value.appearanceSpecifics.trim() },
    { questionId: 'communication_text', value: value.communicationText.trim() },
    { questionId: 'boundaries_chips', value: value.boundaryChips },
    { questionId: 'boundaries_text', value: value.boundaryUnsure ? '' : value.boundaryText.trim() },
    { questionId: 'boundaries_unsure', value: value.boundaryUnsure ? 'true' : 'false' },
  ];

  const buildBasic = (value = draft): OnboardingBasicInput => ({
    name: value.name.trim(),
    age: Number.parseInt(value.age, 10) || 0,
    gender: value.gender,
    genderText: value.gender === 'other' ? value.genderText.trim() : undefined,
    lookingForGender: value.lookingFor,
    heightCm: value.heightCm ? Number.parseInt(value.heightCm, 10) || null : null,
    agePrefMin: value.agePrefMin,
    agePrefMax: value.agePrefMax,
    school: value.school.trim(),
    majorLabel: value.majorLabel.trim(),
    major: value.major,
    campus: value.campus,
    avatarUrl: value.avatarUrl.trim(),
  });

  const buildPersistedDraft = (value = draft, atStep = step): OnboardingDraftV2 => ({
    version: ONBOARDING_VERSION,
    step: atStep,
    basic: buildBasic(value),
    answers: buildAnswers(value),
  });

  const persistPayload = async (payload: OnboardingDraftV2): Promise<number> => {
    const ownerUserId = userId;
    if (!ownerUserId) throw new Error('Not authenticated');
    const fingerprint = JSON.stringify(payload);
    const task = saveQueueRef.current.catch(() => undefined).then(async () => {
      if (activeUserIdRef.current !== ownerUserId) throw new Error('Session changed while saving draft.');
      if (fingerprint === lastSavedFingerprintRef.current) return revisionRef.current;
      setIsAutosaving(true);
      setAutosaveError('');
      try {
        const saved = await saveOnboardingDraft(supabase, payload, revisionRef.current, ownerUserId);
        if (activeUserIdRef.current !== ownerUserId) throw new Error('Session changed while saving draft.');
        revisionRef.current = saved.draftRevision;
        setDraftRevision(saved.draftRevision);
        lastSavedFingerprintRef.current = fingerprint;
        setAnalysis(null);
        setAnalysisRevision(null);
        analysisDraftFingerprintRef.current = '';
        queryClient.setQueryData(onboardingDraftKey, saved);
        return saved.draftRevision;
      } catch (error) {
        if (activeUserIdRef.current === ownerUserId) {
          const message = error instanceof Error ? error.message : 'Chưa tự động lưu được bản nháp.';
          setAutosaveError(message);
        }
        throw error;
      } finally {
        if (activeUserIdRef.current === ownerUserId) setIsAutosaving(false);
      }
    });
    saveQueueRef.current = task;
    return task;
  };

  useEffect(() => {
    if (!hydrated) return;
    if (analysisDraftFingerprintRef.current && analysisDraftFingerprintRef.current !== JSON.stringify(draft)) {
      setAnalysis(null);
      setAnalysisRevision(null);
      setAnalysisError('');
      analysisDraftFingerprintRef.current = '';
    }
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    const payload = buildPersistedDraft();
    if (JSON.stringify(payload) === lastSavedFingerprintRef.current) return;
    autosaveTimerRef.current = setTimeout(() => {
      void persistPayload(payload).catch(() => undefined);
    }, 800);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // build helpers intentionally use this render's immutable draft snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, hydrated, step]);

  const transitionTo = (nextStep: number, direction: number) => {
    setDir(direction);
    setStep(nextStep);
    setStepError('');
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };

  const runAnalyze = async () => {
    const ownerUserId = userId;
    if (!ownerUserId) return;
    setAnalyzing(true);
    setAnalysisError('');
    const analyzedDraft = draft;
    try {
      const revision = await persistPayload(buildPersistedDraft(analyzedDraft, reviewStep));
      const result = await analyzeOnboardingProfile(supabase, {
        draftRevision: revision,
        expectedUserId: ownerUserId,
      });
      if (activeUserIdRef.current !== ownerUserId || revisionRef.current !== result.draftRevision) return;
      setAnalysis(result.analysis);
      setAnalysisRevision(result.analysisRevision);
      analysisDraftFingerprintRef.current = JSON.stringify(analyzedDraft);
      setReviewEdits(reviewFromAnalysis(result.analysis));
    } catch (error) {
      if (activeUserIdRef.current === ownerUserId) {
        setAnalysisError(error instanceof Error ? error.message : 'Chưa phân tích được hồ sơ. Thử lại sau.');
      }
    } finally {
      if (activeUserIdRef.current === ownerUserId) setAnalyzing(false);
    }
  };

  useEffect(() => {
    if (hydrated && step === reviewStep && !analysis && !analyzing && !analysisError) void runAnalyze();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisError, hydrated, step]);

  const pickAvatar = () => {
    const ownerUserId = userId;
    if (!ownerUserId) return;
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      Alert.alert('Tải ảnh trên web', 'Tải ảnh đại diện hiện hỗ trợ trên bản web. Bạn có thể thêm ảnh sau trong hồ sơ.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      setUploadingAvatar(true);
      uploadAvatar(file, file.name)
        .then(url => {
          if (activeUserIdRef.current === ownerUserId) setDraft(d => ({ ...d, avatarUrl: url }));
        })
        .catch(error => {
          if (activeUserIdRef.current === ownerUserId) {
            Alert.alert('Chưa tải được ảnh', error instanceof Error ? error.message : 'Thử lại sau.');
          }
        })
        .finally(() => {
          if (activeUserIdRef.current === ownerUserId) setUploadingAvatar(false);
        });
    };
    input.click();
  };

  const validationForStep = (index: number): string => {
    if (index === 0) {
      if (draft.name.trim().length < 2) return 'Nhập tên hiển thị để tiếp tục.';
      if ((Number.parseInt(draft.age, 10) || 0) < 17) return 'Tuổi cần từ 17 trở lên để tiếp tục.';
      if (!draft.gender) return 'Chọn giới tính để tiếp tục.';
      if (draft.gender === 'other' && draft.genderText.trim().length < 2) return 'Mô tả ngắn về giới tính của bạn.';
      if (draft.lookingFor.length === 0) return 'Chọn bạn muốn được gợi ý ai.';
      if (!draft.school.trim()) return 'Chọn trường của bạn để tiếp tục.';
      if (!draft.majorLabel.trim()) return 'Chọn ngành học của bạn để tiếp tục.';
      if (draft.heightCm.trim() && Number.isNaN(Number.parseInt(draft.heightCm, 10))) return 'Chiều cao cần là một số hợp lệ.';
      if (draft.heightCm.trim() && (Number.parseInt(draft.heightCm, 10) < 120 || Number.parseInt(draft.heightCm, 10) > 230)) return 'Chiều cao cần trong khoảng 120–230 cm.';
      return '';
    }
    if (index === 1) {
      if (draft.needChips.length === 0) return 'Chọn ít nhất một điều bạn đang tìm kiếm.';
      if (draft.needChips.includes(exploreChip) && draft.needText.trim().length < 30) return 'Bạn chọn "Chưa biết" — hãy viết thêm vài dòng (tối thiểu 30 ký tự).';
      return '';
    }
    if (index === 2 && draft.selfText.trim().length < 50) return 'Viết thêm về bạn, tối thiểu 50 ký tự.';
    if (index === 3 && draft.attractionText.trim().length < 50) return 'Mô tả gu thu hút của bạn, tối thiểu 50 ký tự.';
    if (index === 4 && draft.communicationText.trim().length < 40) return 'Mô tả cách bạn thích nói chuyện, tối thiểu 40 ký tự.';
    if (index === 5 && !draft.boundaryUnsure && draft.boundaryText.trim().length < 30) return 'Viết một chút về điều khiến bạn không hợp (tối thiểu 30 ký tự), hoặc chọn "Mình chưa chắc".';
    return '';
  };

  const confirm = async () => {
    const ownerUserId = userId;
    if (!ownerUserId) return;
    if (!analysis || !analysisRevision) return;
    if (analysisDraftFingerprintRef.current !== JSON.stringify(draft)) {
      setAnalysis(null);
      setAnalysisRevision(null);
      setAnalysisError('Câu trả lời đã thay đổi. F-Love cần phân tích lại trước khi lưu.');
      return;
    }
    setIsSaving(true);
    try {
      const currentRevision = await persistPayload(buildPersistedDraft(draft, reviewStep));
      if (activeUserIdRef.current !== ownerUserId) return;
      if (currentRevision !== analysisRevision) {
        setAnalysis(null);
        setAnalysisRevision(null);
        setAnalysisError('Bản nháp vừa được cập nhật. Vui lòng phân tích lại trước khi hoàn tất.');
        return;
      }
      const result = await confirmOnboardingProfile(supabase, {
        draftRevision: currentRevision,
        analysisRevision,
        reviewEdits,
        expectedUserId: ownerUserId,
      });
      if (activeUserIdRef.current !== ownerUserId) return;
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      queryClient.setQueryData(profileKey, result.profile);
      setShowDone(true);
      router.replace('/ai-picks');
    } catch (error) {
      if (activeUserIdRef.current === ownerUserId) {
        Alert.alert('Chưa lưu được hồ sơ', error instanceof Error ? error.message : 'Thử lại sau.');
      }
    } finally {
      if (activeUserIdRef.current === ownerUserId) setIsSaving(false);
    }
  };

  const goNext = async () => {
    if (step === reviewStep) {
      await confirm();
      return;
    }
    const message = validationForStep(step);
    if (message) {
      setStepError(message);
      Alert.alert('Cần thêm một chút', message);
      return;
    }
    setStepError('');
    try {
      await persistPayload(buildPersistedDraft(draft, step + 1));
      transitionTo(step + 1, 1);
    } catch {
      // The inline autosave error offers retry without discarding the current step.
    }
  };

  const exitOnboarding = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

  const goBack = () => {
    if (step > 0) {
      transitionTo(step - 1, -1);
      return;
    }
    if (isEditMode) exitOnboarding();
    else {
      void signOut()
        .catch(error => Alert.alert('Chưa đăng xuất được', error instanceof Error ? error.message : 'Thử lại sau.'))
        .finally(() => router.replace('/login'));
    }
  };

  const progress = Math.round(((step + 1) / stepMetas.length) * 100);
  useEffect(() => {
    Animated.timing(progressAnim, { toValue: progress, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progress, progressAnim]);

  if ((profileQuery.isError && !profileQuery.data) || (persistedDraftQuery.isError && !persistedDraftQuery.data)) {
    return (
      <SafeAreaView style={styles.safe}>
        <LinearGradient colors={gradients.brandSoft} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.loadError}>
          <Text style={styles.loadErrorTitle}>Chưa tải được onboarding</Text>
          <Text style={styles.loadErrorText}>F-Love chưa thể xác nhận bản nháp và hồ sơ hiện tại. Dữ liệu của bạn không bị xoá.</Text>
          <Button onPress={() => { void profileQuery.refetch(); void persistedDraftQuery.refetch(); }}>Thử lại</Button>
        </View>
      </SafeAreaView>
    );
  }

  if (profileQuery.isLoading || persistedDraftQuery.isLoading || !hydrated) {
    return (
      <SafeAreaView style={styles.safe}>
        <LinearGradient colors={gradients.brandSoft} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.loading}><ActivityIndicator color={colors.primaryStrong} /></View>
      </SafeAreaView>
    );
  }

  const current = stepMetas[step];
  const animTranslate = anim.interpolate({ inputRange: [0, 1], outputRange: [dir * 42, 0] });
  const modeLabel = isEditMode ? 'Cập nhật' : 'Onboarding';
  const backDisabled = isSaving || analyzing;
  const backLabel = step === 0 ? (isEditMode ? '✕ Thoát' : 'Đổi tài khoản') : '← Quay lại';
  const nextLabel = step === reviewStep ? 'Hoàn tất ✓' : 'Tiếp tục →';
  const nextDisabled = isSaving || isAutosaving || (step === reviewStep && (analyzing || !analysis || !analysisRevision));

  const renderBody = () => {
    if (step === 0) {
      return (
        <>
          <TextField label="Tên" value={draft.name} onChangeText={name => setDraft(d => ({ ...d, name }))} placeholder="Bạn muốn mọi người gọi bạn là gì?" />
          <TextField label="Tuổi" value={draft.age} onChangeText={age => setDraft(d => ({ ...d, age }))} keyboardType="number-pad" placeholder="Tuổi của bạn" />
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Giới tính</Text>
            <Segmented options={genderOptions} selected={t => draft.gender === t} onSelect={t => setDraft(d => ({ ...d, gender: t }))} />
            {draft.gender === 'other' ? (
              <TextField value={draft.genderText} onChangeText={genderText => setDraft(d => ({ ...d, genderText }))} placeholder="Bạn muốn mô tả như thế nào?" />
            ) : null}
          </View>
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Bạn muốn được gợi ý ai?</Text>
            <Segmented options={lookingForOptions} selected={t => draft.lookingFor.includes(t)} onSelect={t => setDraft(d => ({ ...d, lookingFor: toggle(d.lookingFor, t) }))} />
          </View>
          <SearchableDropdown label="Trường" value={draft.school} placeholder="Tìm trường của bạn" options={schoolOptions}
            onChangeText={school => setDraft(d => ({ ...d, school, campus: inferCampusFromSchool(school) }))}
            onSelect={option => setDraft(d => ({ ...d, school: option.label, campus: option.campus }))} />
          <SearchableDropdown label="Ngành học" value={draft.majorLabel} placeholder="Tìm ngành học của bạn" options={majorOptions}
            onChangeText={majorLabel => setDraft(d => ({ ...d, majorLabel, major: inferMajorFromLabel(majorLabel) }))}
            onSelect={option => setDraft(d => ({ ...d, majorLabel: option.label, major: option.major }))} />
          <TextField label="Chiều cao (không bắt buộc)" value={draft.heightCm} onChangeText={heightCm => setDraft(d => ({ ...d, heightCm }))} keyboardType="number-pad" placeholder="Ví dụ: 172" />
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Ảnh đại diện (không bắt buộc)</Text>
            <View style={styles.photoRow}>
              <Pressable accessibilityRole="button" onPress={pickAvatar} style={({ pressed }) => [styles.photoTile, draft.avatarUrl && styles.photoTileFilled, pressed && styles.pressed]}>
                {draft.avatarUrl ? <Image source={{ uri: draft.avatarUrl }} style={styles.photoImage} resizeMode="cover" /> : <><Text style={styles.photoPlus}>＋</Text><Text style={styles.photoHint}>ảnh đại diện</Text></>}
                {uploadingAvatar ? <View style={styles.photoOverlay}><ActivityIndicator color={colors.onPrimary} /></View> : null}
              </Pressable>
              <Text style={styles.photoCopyText}>Hồ sơ có ảnh nhận được nhiều lượt ghép hơn. Chạm để {draft.avatarUrl ? 'đổi ảnh' : 'chọn ảnh'}.</Text>
            </View>
          </View>
        </>
      );
    }
    if (step === 1) {
      return (
        <>
          <View style={styles.options}>
            {needChipOptions.map(option => (
              <ChipButton key={option} label={option} selected={draft.needChips.includes(option)} onPress={() => setDraft(d => ({ ...d, needChips: toggle(d.needChips, option) }))} />
            ))}
          </View>
          <TextField label="Nói rõ hơn một chút bằng lời của bạn" value={draft.needText} onChangeText={needText => setDraft(d => ({ ...d, needText }))}
            placeholder="Ví dụ: Mình muốn gặp người nói chuyện hợp, bắt đầu nhẹ nhàng trước; nếu hợp thì tìm hiểu nghiêm túc hơn." helperText={longTextHelper(draft.needText, 30)} multiline />
        </>
      );
    }
    if (step === 2) {
      return (
        <>
          <TextField label="Nếu phải giới thiệu bản thân với một người chưa biết gì về bạn, bạn sẽ nói gì?" value={draft.selfText} onChangeText={selfText => setDraft(d => ({ ...d, selfText }))}
            placeholder="Ví dụ: Mình hơi hướng nội, thích cafe yên tĩnh, thích học cái mới, chơi game/xem phim cuối tuần..." helperText={longTextHelper(draft.selfText, 50)} multiline />
          <Text style={styles.hintLabel}>Gợi ý (không bắt buộc)</Text>
          <View style={styles.options}>
            {selfHintChips.map(option => (
              <ChipButton key={option} label={option} selected={draft.selfChips.includes(option)} onPress={() => setDraft(d => ({ ...d, selfChips: toggle(d.selfChips, option) }))} />
            ))}
          </View>
        </>
      );
    }
    if (step === 3) {
      return (
        <>
          <TextField label="Bạn thường bị thu hút bởi kiểu người như thế nào?" value={draft.attractionText} onChangeText={attractionText => setDraft(d => ({ ...d, attractionText }))}
            placeholder="Có thể nói về tính cách, cách nói chuyện, lối sống, mục tiêu, ngoại hình, chiều cao, cách ăn mặc, vibe..." helperText={longTextHelper(draft.attractionText, 50)} multiline />
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Ngoại hình/phong cách có quan trọng với bạn không?</Text>
            <Segmented options={importanceOptions} selected={t => draft.appearanceImportance === t} onSelect={t => setDraft(d => ({ ...d, appearanceImportance: t }))} />
          </View>
          <TextField label="Preference cụ thể (không bắt buộc)" value={draft.appearanceSpecifics} onChangeText={appearanceSpecifics => setDraft(d => ({ ...d, appearanceSpecifics }))}
            placeholder="Ví dụ: mình thích người gọn gàng, biết chăm sóc bản thân. Chiều cao không quá quan trọng." multiline />
        </>
      );
    }
    if (step === 4) {
      return (
        <>
          <TextField label="Bạn thích nói chuyện với người khác theo kiểu nào?" value={draft.communicationText} onChangeText={communicationText => setDraft(d => ({ ...d, communicationText }))}
            placeholder="Ví dụ: Mình thích nói chuyện chậm rãi, không áp lực rep nhanh; thích trò chuyện có chiều sâu nhưng thỉnh thoảng vui/meme cũng được." helperText={longTextHelper(draft.communicationText, 40)} multiline />
          <View style={styles.helperPrompts}>
            {['Bạn thích nhắn nhiều hay ít?', 'Thích nói chuyện sâu hay vui vẻ?', 'Rep nhanh/chậm có quan trọng không?', 'Bạn hay mở lời trước hay để tự nhiên?', 'Thích gặp ngoài đời nhanh hay cần thời gian?'].map(prompt => (
              <Text key={prompt} style={styles.helperPrompt}>• {prompt}</Text>
            ))}
          </View>
        </>
      );
    }
    if (step === 5) {
      return (
        <>
          <TextField label="Điều gì khiến bạn thấy không hợp ngay từ đầu?" value={draft.boundaryText} editable={!draft.boundaryUnsure}
            onChangeText={boundaryText => setDraft(d => ({ ...d, boundaryText }))}
            placeholder="Ví dụ: nói chuyện hời hợt, không tôn trọng ranh giới, quá party, không rõ mình muốn gì, hút thuốc, lệch mục tiêu..." helperText={draft.boundaryUnsure ? 'Đã chọn "Mình chưa chắc".' : longTextHelper(draft.boundaryText, 30)} multiline />
          <Pressable accessibilityRole="button" onPress={() => setDraft(d => ({ ...d, boundaryUnsure: !d.boundaryUnsure }))} style={({ pressed }) => [styles.unsureRow, pressed && styles.pressed]}>
            <View style={[styles.checkbox, draft.boundaryUnsure && styles.checkboxOn]}>{draft.boundaryUnsure ? <Text style={styles.checkboxMark}>✓</Text> : null}</View>
            <Text style={styles.unsureText}>Mình chưa chắc</Text>
          </Pressable>
          <Text style={styles.hintLabel}>Gợi ý (không bắt buộc)</Text>
          <View style={styles.options}>
            {boundaryChipOptions.map(option => (
              <ChipButton key={option} label={option} selected={draft.boundaryChips.includes(option)} onPress={() => setDraft(d => ({ ...d, boundaryChips: toggle(d.boundaryChips, option) }))} />
            ))}
          </View>
        </>
      );
    }
    // Review
    if (analysisError && !analyzing) {
      return (
        <View style={styles.analysisErrorCard}>
          <Text style={styles.loadErrorTitle}>Chưa phân tích được hồ sơ</Text>
          <Text style={styles.loadErrorText}>{analysisError}</Text>
          <Button onPress={() => { setAnalysisError(''); void runAnalyze(); }}>Phân tích lại</Button>
        </View>
      );
    }
    if (analyzing || !analysis) {
      return (
        <View style={styles.reviewLoading}>
          <ActivityIndicator color={colors.primaryStrong} />
          <Text style={styles.reviewLoadingText}>F-Love đang đọc hồ sơ của bạn…</Text>
        </View>
      );
    }
    const cards: Array<{ key: keyof ReviewEdits; caption: string }> = [
      { key: 'selfSummary', caption: 'AI hiểu bạn là' },
      { key: 'seekingSummary', caption: 'Bạn đang tìm' },
      { key: 'idealMatchSummary', caption: 'Gu người dễ hợp với bạn' },
      { key: 'avoidSummary', caption: 'Nên tránh khi ghép bạn' },
      { key: 'suggestedBio', caption: 'Bio gợi ý' },
    ];
    return (
      <View style={styles.reviewList}>
        {cards.map(card => (
          <View key={card.key} style={styles.reviewCard}>
            <Text style={styles.reviewCaption}>{card.caption}</Text>
            <TextField value={reviewEdits[card.key]} onChangeText={text => setReviewEdits(prev => ({ ...prev, [card.key]: text }))} multiline />
          </View>
        ))}
        <Text style={styles.reviewHint}>Chạm vào từng ô để sửa nếu AI hiểu chưa đúng. Bấm "Hoàn tất" để lưu hồ sơ và mở khoá AI Picks.</Text>
      </View>
    );
  };

  const page = (
    <View style={[styles.page, isWide && styles.pageWide]}>
      <View style={styles.headerRow}>
        <View style={styles.brandRow}>
          <Image source={logoImage} resizeMode="cover" style={styles.brandTile} />
          <Text style={styles.brandWord}>F-Love</Text>
        </View>
        <Text style={styles.modeTab}>{modeLabel}</Text>
      </View>

      <View style={styles.progressRow}>
        <Text style={styles.progressStep}>Bước {step + 1}/{stepMetas.length}</Text>
        <Text style={styles.progressPct}>{progress}%</Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fillWrap, { width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]}>
          <LinearGradient colors={gradients.meter} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fill} />
        </Animated.View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: anim, transform: [{ translateX: animTranslate }] }}>
          <View style={styles.stepHeader}>
            <StepIcon emoji={current.icon} size={isWide ? 54 : 46} />
            <View style={styles.stepHeaderText}>
              <Text style={[styles.title, isWide && styles.titleWide]}>{current.title}</Text>
              <Text style={styles.subtitle}>{current.subtitle}</Text>
            </View>
          </View>
          <View style={styles.body}>{renderBody()}</View>
          {stepError ? <Text style={styles.errorText}>{stepError}</Text> : null}
          {autosaveError ? (
            <Pressable accessibilityRole="button" onPress={() => void persistPayload(buildPersistedDraft()).catch(() => undefined)}>
              <Text style={styles.errorText}>{autosaveError} · Chạm để thử lưu lại</Text>
            </Pressable>
          ) : (
            <Text style={styles.autosaveText}>{isAutosaving ? 'Đang lưu bản nháp…' : draftRevision > 0 ? `Đã lưu bản nháp #${draftRevision}` : 'Bản nháp sẽ tự động được lưu'}</Text>
          )}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, isWide && styles.footerWide]}>
        <Button variant="secondary" disabled={backDisabled} onPress={goBack} style={isWide ? styles.backButtonWide : styles.backButton}>{backLabel}</Button>
        <Button disabled={nextDisabled} onPress={goNext} style={styles.nextButton}>{nextLabel}</Button>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={isWide ? ['#F9CF97', '#FCE6C8', '#FFF4E8'] : ['#FFE7D2', '#FFF1E6', '#FFF7EF']} start={{ x: 1, y: 0 }} end={{ x: 0.15, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <FloatingHeart top={90} left={26} size={16} delay={0} />
        <FloatingHeart top={140} right={36} size={22} delay={700} />
        <FloatingHeart bottom={170} left={30} size={18} delay={1200} />
        <FloatingHeart bottom={120} right={28} size={26} delay={400} />
      </View>

      {isWide ? (
        <View style={styles.wideCenter}>
          <View style={styles.notebook}>
            <View style={styles.binding}>{Array.from({ length: 11 }).map((_, index) => <View key={index} style={styles.ring} />)}</View>
            {page}
          </View>
        </View>
      ) : page}

      {showDone ? (
        <LinearGradient colors={gradients.welcome} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={[StyleSheet.absoluteFill, styles.doneOverlay]}>
          <View style={styles.doneCheck}><Text style={styles.doneCheckText}>✓</Text></View>
          <Text style={styles.doneTitle}>Hoàn tất hồ sơ!</Text>
          <Text style={styles.doneSub}>F-Love đang tìm những người hợp gu nhất cho bạn…</Text>
        </LinearGradient>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadError: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  loadErrorTitle: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  loadErrorText: { color: colors.muted, fontSize: 13.5, lineHeight: 20, textAlign: 'center', maxWidth: 420 },
  heart: { position: 'absolute', color: '#F4A668' },

  wideCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  notebook: {
    flexDirection: 'row', width: '100%', maxWidth: 980, flex: 1, maxHeight: 780, borderRadius: 30,
    backgroundColor: '#FBF3E7', borderWidth: 1, borderColor: 'rgba(220,180,140,0.35)', overflow: 'hidden',
    shadowColor: '#965028', shadowOpacity: 0.28, shadowRadius: 60, shadowOffset: { width: 0, height: 40 }, elevation: 8,
  },
  binding: { width: 56, backgroundColor: '#F2E6D4', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 30, borderRightWidth: 1, borderRightColor: 'rgba(210,170,130,0.35)' },
  ring: { width: 24, height: 10, borderRadius: 999, borderWidth: 3, borderColor: '#C98A4E', borderTopColor: '#9B6630', backgroundColor: '#FBF3E7' },

  page: { flex: 1, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 16 },
  pageWide: { paddingHorizontal: 44, paddingTop: 30, paddingBottom: 24, backgroundColor: 'transparent' },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandTile: { width: 32, height: 32, borderRadius: 10, shadowColor: '#D6764C', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  brandTileText: { color: colors.onPrimary, fontWeight: '800', fontSize: 16 },
  brandWord: { fontWeight: '800', fontSize: 16, color: colors.text, letterSpacing: -0.2 },
  modeTab: { color: colors.primaryDeep, fontSize: 12, fontWeight: '600', letterSpacing: 0.6, borderBottomWidth: 1.5, borderBottomColor: '#F6C08A', paddingBottom: 2, ...Platform.select({ web: { fontFamily: fonts.mono } }) },

  progressRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  progressStep: { color: colors.textSoft, fontSize: 12.5, fontWeight: '600' },
  progressPct: { color: colors.primaryStrong, fontSize: 14, fontWeight: '800' },
  track: { height: 9, borderRadius: 999, backgroundColor: '#FBE6CF', overflow: 'hidden', marginBottom: 18 },
  fillWrap: { height: '100%' },
  fill: { flex: 1, borderRadius: 999 },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 12 },

  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  stepHeaderText: { flex: 1, gap: 4 },
  stepIcon: { backgroundColor: '#FCE6CB', borderWidth: 1.5, borderColor: '#F6C79B', alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 23, fontWeight: '800', letterSpacing: -0.4, lineHeight: 28 },
  titleWide: { fontSize: 29, lineHeight: 33 },
  subtitle: { color: colors.muted, fontSize: 13.5, lineHeight: 19 },

  body: { gap: 16 },
  fieldBlock: { gap: 9 },
  fieldLabel: { color: colors.textSoft, fontSize: 13, fontWeight: '700' },
  hintLabel: { color: colors.muted, fontSize: 12.5, fontWeight: '700', marginTop: 2 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  segmentWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  segment: { borderRadius: radii.pill, borderWidth: 1.5, borderColor: '#F0DDC6', backgroundColor: colors.surface, paddingHorizontal: 15, paddingVertical: 9 },
  segmentOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  segmentText: { color: '#6A5A4C', fontSize: 13.5, fontWeight: '600' },
  segmentTextOn: { color: colors.onPrimary },

  dropdownBlock: { gap: 9 },
  dropdownMenu: { borderRadius: radii.md, borderWidth: 1.5, borderColor: colors.borderSoft, backgroundColor: colors.surface, overflow: 'hidden' },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  dropdownItemSelected: { backgroundColor: colors.surfaceTint },
  dropdownItemText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  dropdownItemTextSelected: { color: colors.primaryText },

  chip: { minHeight: 40, justifyContent: 'center', borderRadius: radii.pill, borderWidth: 1.5, borderColor: '#F0DDC6', backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 10 },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  chipText: { color: '#6A5A4C', fontSize: 13.5, fontWeight: '600' },
  chipTextSelected: { color: colors.onPrimary },
  pressed: { opacity: 0.82 },

  helperPrompts: { gap: 5, backgroundColor: colors.surfaceWarm, borderRadius: radii.md, padding: 14 },
  helperPrompt: { color: colors.noteText, fontSize: 12.5, lineHeight: 18 },

  unsureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: colors.borderSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: colors.onPrimary, fontSize: 13, fontWeight: '800' },
  unsureText: { color: colors.textSoft, fontSize: 14, fontWeight: '700' },

  photoRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  photoTile: { width: 92, height: 116, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', borderColor: '#E6C7A8', backgroundColor: '#FFF6EC', alignItems: 'center', justifyContent: 'center', gap: 5, overflow: 'hidden' },
  photoTileFilled: { borderStyle: 'solid', borderColor: '#F2B271' },
  photoImage: { width: '100%', height: '100%' },
  photoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(43,33,26,0.35)', alignItems: 'center', justifyContent: 'center' },
  photoPlus: { fontSize: 24, color: '#C2825F' },
  photoHint: { fontSize: 9, letterSpacing: 0.6, color: '#C2825F', ...Platform.select({ web: { fontFamily: fonts.mono } }) },
  photoCopyText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 19 },

  reviewLoading: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 40 },
  reviewLoadingText: { color: colors.textSoft, fontSize: 14, fontWeight: '600' },
  analysisErrorCard: { alignItems: 'center', gap: 12, padding: 20, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface },
  reviewList: { gap: 12 },
  reviewCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: '#F0DDC6', borderRadius: radii.lg, padding: 14, gap: 8 },
  reviewCaption: { color: '#C2825F', fontSize: 11.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  reviewHint: { color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 2 },

  errorText: { color: '#B42318', fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 12 },
  autosaveText: { color: colors.muted, fontSize: 11.5, lineHeight: 16, marginTop: 10, textAlign: 'right' },

  footer: { flexDirection: 'row', gap: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  footerWide: { borderTopColor: '#E3CBAE', borderStyle: 'dashed', paddingTop: 20 },
  backButton: { flex: 0.85 },
  backButtonWide: { width: 200, flexGrow: 0 },
  nextButton: { flex: 1 },

  doneOverlay: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  doneCheck: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  doneCheckText: { fontSize: 48, color: colors.onPrimary, fontWeight: '800' },
  doneTitle: { fontSize: 28, fontWeight: '800', color: colors.onPrimary, textAlign: 'center' },
  doneSub: { fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.95)', textAlign: 'center', marginTop: 12, maxWidth: 280 },
});
