import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { BrandMark } from '@/components/BrandMark';
import { MeterBar } from '@/components/MeterBar';
import { colors, fonts, gradients, radii } from '@/theme';

const MAX_WIDTH = 1180;

function goLogin() {
  router.push('/login');
}

// react-native-web turns `dataSet` into data-* attributes that the injected CSS
// (see AppProviders) hooks animations onto. No-op on native.
const animProps = (name: string) =>
  (Platform.OS === 'web' ? ({ dataSet: { anim: name } } as object) : {});

/** Animated shimmer strip that sweeps across a container (web only). */
function Sweep({ width = 160, fast = false }: { width?: number; fast?: boolean }) {
  if (Platform.OS !== 'web') return null;
  return (
    <View
      pointerEvents="none"
      {...animProps(fast ? 'sweep-fast' : 'sweep')}
      style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width, zIndex: 1 }}
    >
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ flex: 1 }}
      />
    </View>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

function NavLink({ children }: { children: ReactNode }) {
  return (
    <Pressable onPress={goLogin}>
      <Text style={styles.navLink}>{children}</Text>
    </Pressable>
  );
}

function PrimaryPill({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress ?? goLogin} style={styles.pillShadow}>
      <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pill}>
        <Text style={styles.pillText}>{children}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function FeatureCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <View style={styles.featureCard}>
      <LinearGradient colors={['#FDE9C0', '#F9CE84']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.featureIcon}>
        <Text style={{ fontSize: 26 }}>{icon}</Text>
      </LinearGradient>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureBody}>{body}</Text>
    </View>
  );
}

function PricingCard({
  icon,
  title,
  price,
  lines,
  featured = false,
}: {
  icon: string;
  title: string;
  price: string;
  lines: string[];
  featured?: boolean;
}) {
  const content = (
    <>
      <Text style={[styles.pricingIcon, featured && styles.pricingIconFeatured]}>{icon}</Text>
      <Text style={[styles.pricingTitle, featured && styles.pricingTextFeatured]}>{title}</Text>
      <Text style={[styles.pricingPrice, featured && styles.pricingTextFeatured]}>{price}</Text>
      <View style={styles.pricingLines}>
        {lines.map((line) => (
          <Text key={line} style={[styles.pricingLine, featured && styles.pricingTextFeatured]}>
            {line}
          </Text>
        ))}
      </View>
    </>
  );

  if (featured) {
    return (
      <LinearGradient colors={['#F25513', '#EC6C1A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.pricingCard, styles.pricingCardFeatured]}>
        {content}
      </LinearGradient>
    );
  }

  return <View style={styles.pricingCard}>{content}</View>;
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepBody}>{body}</Text>
    </View>
  );
}

function SafetyRow({ children }: { children: ReactNode }) {
  return (
    <View style={styles.safetyRow}>
      <View style={styles.checkBox}>
        <Text style={styles.checkMark}>✓</Text>
      </View>
      <Text style={styles.safetyText}>{children}</Text>
    </View>
  );
}

function PhoneMockup() {
  return (
    <View style={styles.phone} {...animProps('floaty')}>
      <View style={styles.phoneScreen}>
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>9:41</Text>
          <Text style={styles.statusText}>▮▮▮ ᯤ</Text>
        </View>
        <View style={styles.phoneBody}>
          <Text style={styles.phoneTitle}>AI Picks</Text>
          <Text style={styles.phoneSub}>Gợi ý hôm nay</Text>
          <View style={styles.pickCard}>
            <LinearGradient colors={['#FBCB72', '#F4943A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.pickHeader}>
              <Sweep width={60} fast />
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreBadgeText}>❤ 96%</Text>
              </View>
              <Text style={styles.pickGhost}>M</Text>
              <View>
                <Text style={styles.pickName}>Minh Anh, 27</Text>
                <Text style={styles.pickMeta}>Marketing · Hà Nội</Text>
              </View>
            </LinearGradient>
            <View style={styles.pickMeters}>
              <View style={styles.pickMeterHead}>
                <Text style={{ fontSize: 11 }}>✨</Text>
                <Text style={styles.pickMeterTitle}>Phân tích tương hợp</Text>
              </View>
              <MeterBar label="Giá trị sống" value={87} />
              <MeterBar label="Sở thích" value={92} />
              <MeterBar label="Tính cách" value={89} />
            </View>
          </View>
          <View style={styles.pickActions}>
            <View style={styles.skipBtn}>
              <Text style={styles.skipText}>✕</Text>
            </View>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.likeBtn}>
              <Text style={styles.likeText}>❤</Text>
            </LinearGradient>
          </View>
        </View>
      </View>
    </View>
  );
}

export function WebLanding() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.rootContent}>
      {/* NAV */}
      <View style={styles.nav}>
        <View style={styles.navInner}>
          <BrandMark size={40} showWordmark />
          <View style={styles.navLinks}>
            <NavLink>Tính năng</NavLink>
            <NavLink>Cách hoạt động</NavLink>
            <NavLink>An toàn</NavLink>
            <NavLink>Cộng đồng</NavLink>
          </View>
          <View style={styles.navCtas}>
            <Pressable onPress={goLogin}>
              <Text style={styles.navSignin}>Đăng nhập</Text>
            </Pressable>
            <PrimaryPill>Tải app</PrimaryPill>
          </View>
        </View>
      </View>

      {/* HERO */}
      <LinearGradient colors={['#FBC067', '#FDE3BE', '#FFF7EF']} start={{ x: 1, y: 0 }} end={{ x: 0.2, y: 1 }} style={styles.hero}>
        <Sweep width={160} />
        <View style={styles.heroInner}>
          <View style={styles.heroCopy}>
            <Text style={styles.h1} {...animProps('reveal')}>
              Ghép đôi thông minh hơn,{'\n'}
              <Text style={styles.h1Accent}>kết nối thật hơn</Text>
            </Text>
            <Text style={styles.heroLead}>
              F-Love dùng AI để gợi ý những người thật sự hợp với bạn — dựa trên giá trị sống, sở thích và tính cách,
              không chỉ là vài tấm ảnh.
            </Text>
            <View style={styles.heroBtns}>
              <PrimaryPill>Bắt đầu miễn phí</PrimaryPill>
              <Pressable onPress={goLogin} style={styles.outlineBtn}>
                <Text style={styles.outlineBtnText}>Xem cách hoạt động</Text>
              </Pressable>
            </View>
            <View style={styles.stats}>
              <View>
                <Text style={[styles.statNum, { color: '#F2802E' }]}>12K+</Text>
                <Text style={styles.statLabel}>sinh viên</Text>
              </View>
              <View style={styles.statDivider} />
              <View>
                <Text style={[styles.statNum, { color: '#F79A2E' }]}>94%</Text>
                <Text style={styles.statLabel}>độ hài lòng</Text>
              </View>
              <View style={styles.statDivider} />
              <View>
                <Text style={[styles.statNum, { color: '#F6A82E' }]}>3.2K</Text>
                <Text style={styles.statLabel}>cặp đôi</Text>
              </View>
            </View>
          </View>
          <View style={styles.heroPhoneWrap}>
            <View pointerEvents="none" {...animProps('pulse')} style={styles.phoneGlow} />
            <PhoneMockup />
          </View>
        </View>
      </LinearGradient>

      {/* FEATURES */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Eyebrow>Tính năng</Eyebrow>
          <Text style={styles.h2}>Mọi thứ bạn cần để kết nối tốt hơn</Text>
        </View>
        <View style={styles.featureGrid}>
          <FeatureCard icon="✨" title="AI Matching" body="Gợi ý người phù hợp dựa trên dữ liệu và thuật toán tiên tiến, kèm điểm tương hợp rõ ràng." />
          <FeatureCard icon="💬" title="AI Wingman" body="Hỗ trợ mở lời và giao tiếp thông minh, tự tin hơn trong mọi cuộc trò chuyện." />
          <FeatureCard icon="🎭" title="Blind Date" body="Trò chuyện ẩn danh trước, tiết lộ danh tính khi cả hai đã thực sự sẵn sàng." />
        </View>
      </View>

      {/* PRICING */}
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Eyebrow>Gói dịch vụ</Eyebrow>
          <Text style={styles.h2}>Chọn gói phù hợp với cách bạn muốn được ghép đôi</Text>
        </View>
        <View style={styles.pricingGrid}>
          <PricingCard icon="▰" title="Normal Pack" price="99.000đ" lines={['1 lần setup matching']} />
          <PricingCard icon="◇" title="Premium Pack" price="299.000đ" lines={['3 setups', 'Wingman AI Consultation']} featured />
          <PricingCard icon="❤" title="Love Coach Pack" price="699.000đ" lines={['5 setups', 'Premium features', 'Profile/Chat reviews per setup']} />
        </View>
        <View style={styles.revenueRow}>
          <Text style={styles.revenueTitle}>Revenue{'\n'}Streams</Text>
          <View style={styles.trialBox}>
            <Text style={styles.trialText}>We are offering free trials, please fill in this form</Text>
            <Text style={styles.trialLink}>https://forms.gle/XNUJBFMU8osCoxG7</Text>
          </View>
        </View>
      </View>

      {/* HOW IT WORKS */}
      <View style={styles.section}>
        <LinearGradient colors={['#FFF4E3', '#FEEBCB']} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} style={styles.howCard}>
          <View style={styles.sectionHead}>
            <Eyebrow>Cách hoạt động</Eyebrow>
            <Text style={styles.h2}>Ghép đôi trong 3 bước</Text>
          </View>
          <View style={styles.stepGrid}>
            <Step n="1" title="Tạo hồ sơ" body="Chia sẻ sở thích, giá trị sống và điều bạn tìm kiếm." />
            <Step n="2" title="Nhận AI Picks" body="Mỗi ngày nhận batch gợi ý được tuyển chọn kèm lý do." />
            <Step n="3" title="Kết nối & trò chuyện" body="Khi cả hai cùng thích, bắt đầu cuộc trò chuyện có AI Wingman." />
          </View>
        </LinearGradient>
      </View>

      {/* SAFE */}
      <View style={styles.section}>
        <View style={styles.safeGrid}>
          <View style={styles.safeCopy}>
            <Eyebrow>An toàn & tin cậy</Eyebrow>
            <Text style={styles.h2Left}>Kết nối an toàn, thân thiện</Text>
            <Text style={styles.heroLead}>
              Mọi tài khoản đều được xác thực qua email FPT. Bảo vệ thông tin, báo cáo và chặn dễ dàng.
            </Text>
            <View style={styles.safetyList}>
              <SafetyRow>Xác thực email sinh viên FPT</SafetyRow>
              <SafetyRow>Báo cáo & chặn người dùng nhanh</SafetyRow>
              <SafetyRow>Dữ liệu được bảo mật, kiểm duyệt</SafetyRow>
            </View>
          </View>
          <LinearGradient colors={['#F9A93C', '#EC6C1A']} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={styles.safeCard}>
            <Text style={{ fontSize: 60, marginBottom: 16 }}>🛡️</Text>
            <Text style={styles.safeCardTitle}>100% xác thực</Text>
            <Text style={styles.safeCardBody}>Chỉ sinh viên FPT đã xác minh mới có thể tham gia cộng đồng F-Love.</Text>
          </LinearGradient>
        </View>
      </View>

      {/* CTA */}
      <View style={[styles.section, { paddingBottom: 88 }]}>
        <LinearGradient colors={['#F89233', '#EC6C1A']} start={{ x: 0.8, y: 0 }} end={{ x: 0.2, y: 1 }} style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>Sẵn sàng tìm người hợp gu?</Text>
          <Text style={styles.ctaLead}>Tải F-Love và nhận những gợi ý đầu tiên ngay hôm nay.</Text>
          <View style={styles.ctaBtns}>
            <Pressable onPress={goLogin} style={styles.ctaBtnLight}>
              <Text style={styles.ctaBtnLightText}>App Store</Text>
            </Pressable>
            <Pressable onPress={goLogin} style={styles.ctaBtnGhost}>
              <Text style={styles.ctaBtnGhostText}>Google Play</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>

      {/* FOOTER */}
      <View style={styles.footer}>
        <View style={styles.footerInner}>
          <BrandMark size={36} showWordmark showTagline />
          <View style={styles.footerLinks}>
            <NavLink>Điều khoản</NavLink>
            <NavLink>Bảo mật</NavLink>
            <NavLink>Hỗ trợ</NavLink>
            <NavLink>Liên hệ</NavLink>
          </View>
          <Text style={styles.copyright}>© 2026 F-Love · FPT University</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const monoFont = Platform.select({ web: { fontFamily: fonts.mono } });

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  rootContent: { backgroundColor: colors.background },

  // NAV
  nav: {
    backgroundColor: 'rgba(255,247,239,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(244,227,212,0.7)',
  },
  navInner: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
  },
  navLinks: { flexDirection: 'row', alignItems: 'center', gap: 34, flexWrap: 'wrap' },
  navLink: { fontSize: 14.5, fontWeight: '600', color: colors.textSoft },
  navCtas: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navSignin: { fontSize: 14.5, fontWeight: '700', color: colors.primaryDeep, paddingHorizontal: 8, paddingVertical: 10 },

  pillShadow: {
    borderRadius: radii.pill,
    shadowColor: '#D6764C',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  pill: { paddingVertical: 11, paddingHorizontal: 22, borderRadius: radii.pill, alignItems: 'center' },
  pillText: { color: colors.onPrimary, fontWeight: '700', fontSize: 14.5 },

  // HERO
  hero: { width: '100%', overflow: 'hidden' },
  phoneGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(249,180,63,0.35)',
    top: 40,
    left: '50%',
    marginLeft: -160,
  },
  heroInner: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
    paddingBottom: 90,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 48,
    alignItems: 'center',
  },
  heroCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 420, minWidth: 320 },
  h1: { fontSize: 56, lineHeight: 60, fontWeight: '800', letterSpacing: -1.4, color: colors.text },
  h1Accent: { color: colors.primaryStrong },
  heroLead: { fontSize: 18, lineHeight: 29, color: '#7A6B5E', marginTop: 22, maxWidth: 480 },
  heroBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 34 },
  outlineBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: '#F4D8C2',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: radii.lg,
    justifyContent: 'center',
  },
  outlineBtnText: { fontSize: 16, fontWeight: '700', color: colors.primaryDeep },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 24, marginTop: 40, flexWrap: 'wrap' },
  statNum: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 13, color: colors.muted },
  statDivider: { width: 1, height: 34, backgroundColor: '#F0DDCC' },
  heroPhoneWrap: { flexGrow: 1, flexShrink: 1, flexBasis: 320, alignItems: 'center', justifyContent: 'center' },

  // PHONE MOCKUP
  phone: {
    width: 290,
    height: 500,
    borderRadius: 38,
    backgroundColor: '#1c150f',
    padding: 9,
    shadowColor: 'rgba(150,70,40,1)',
    shadowOpacity: 0.5,
    shadowRadius: 45,
    shadowOffset: { width: 0, height: 40 },
  },
  phoneScreen: { flex: 1, borderRadius: 30, overflow: 'hidden', backgroundColor: colors.background },
  statusBar: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 8,
  },
  statusText: { fontSize: 11, fontWeight: '700', color: colors.text },
  phoneBody: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 6 },
  phoneTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  phoneSub: { fontSize: 11, color: colors.muted, marginBottom: 12 },
  pickCard: { borderRadius: radii.xl, overflow: 'hidden', backgroundColor: colors.surface },
  pickHeader: { height: 170, justifyContent: 'flex-end', padding: 14 },
  scoreBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radii.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  scoreBadgeText: { fontWeight: '800', fontSize: 11, color: colors.primaryDeep },
  pickGhost: { position: 'absolute', top: 4, left: 14, fontSize: 80, fontWeight: '800', color: 'rgba(255,255,255,0.32)' },
  pickName: { fontSize: 17, fontWeight: '800', color: colors.onPrimary },
  pickMeta: { fontSize: 11, color: 'rgba(255,255,255,0.95)' },
  pickMeters: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14, gap: 9 },
  pickMeterHead: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 1 },
  pickMeterTitle: { fontSize: 10.5, fontWeight: '800', color: colors.text },
  pickActions: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 12 },
  skipBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: { fontSize: 18, color: colors.mutedLight },
  likeBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  likeText: { fontSize: 20, color: colors.onPrimary },

  // SECTIONS
  section: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 64, paddingBottom: 24 },
  sectionHead: { alignItems: 'center', maxWidth: 620, alignSelf: 'center', marginBottom: 44 },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 3,
    color: colors.primaryDeep,
    marginBottom: 14,
    textTransform: 'uppercase',
    fontWeight: '600',
    ...monoFont,
  },
  h2: { fontSize: 38, fontWeight: '800', letterSpacing: -0.8, lineHeight: 44, color: colors.text, textAlign: 'center' },
  h2Left: { fontSize: 38, fontWeight: '800', letterSpacing: -0.8, lineHeight: 44, color: colors.text, marginTop: 4 },

  // FEATURES
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  featureCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 280,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xxl,
    padding: 28,
  },
  featureIcon: { width: 56, height: 56, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  featureTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 9 },
  featureBody: { fontSize: 14.5, lineHeight: 23, color: '#7A6B5E' },

  // PRICING
  pricingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'stretch' },
  pricingCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 300,
    minHeight: 250,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: '#211C18',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 28,
    justifyContent: 'flex-start',
  },
  pricingCardFeatured: {
    backgroundColor: colors.primaryStrong,
  },
  pricingIcon: { fontSize: 34, lineHeight: 40, color: colors.primaryStrong, marginBottom: 14 },
  pricingIconFeatured: { color: colors.onPrimary },
  pricingTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 10 },
  pricingPrice: { fontSize: 38, lineHeight: 44, fontWeight: '900', color: '#111111', marginBottom: 8 },
  pricingLines: { gap: 5 },
  pricingLine: { fontSize: 20, lineHeight: 28, fontWeight: '800', color: colors.text },
  pricingTextFeatured: { color: colors.onPrimary },
  revenueRow: {
    marginTop: 44,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 28,
    alignItems: 'center',
  },
  revenueTitle: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 260,
    fontSize: 46,
    lineHeight: 52,
    fontWeight: '900',
    color: '#111111',
  },
  trialBox: {
    flexGrow: 2,
    flexShrink: 1,
    flexBasis: 420,
    borderWidth: 2,
    borderColor: '#211C18',
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: colors.surface,
  },
  trialText: { fontSize: 20, lineHeight: 29, color: colors.text },
  trialLink: { fontSize: 20, lineHeight: 29, fontWeight: '900', color: '#111111' },

  // HOW
  howCard: { borderRadius: 32, borderWidth: 1, borderColor: '#F9E6C8', paddingVertical: 56, paddingHorizontal: 48 },
  stepGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 32, justifyContent: 'center' },
  step: { flexGrow: 1, flexShrink: 1, flexBasis: 220, alignItems: 'center' },
  stepNum: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: '#F4D8C2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  stepNumText: { fontSize: 24, fontWeight: '800', color: '#F2802E' },
  stepTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 },
  stepBody: { fontSize: 14, lineHeight: 22, color: '#7A6B5E', textAlign: 'center' },

  // SAFE
  safeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 56, alignItems: 'center' },
  safeCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 360, minWidth: 300 },
  safetyList: { gap: 16, marginTop: 28 },
  safetyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkBox: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surfaceTint, alignItems: 'center', justifyContent: 'center' },
  checkMark: { color: '#F2802E', fontWeight: '800' },
  safetyText: { fontSize: 15, fontWeight: '600', color: colors.textSoft },
  safeCard: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 360,
    minWidth: 300,
    borderRadius: 28,
    padding: 48,
    alignItems: 'center',
  },
  safeCardTitle: { fontSize: 24, fontWeight: '800', color: colors.onPrimary },
  safeCardBody: { fontSize: 15, lineHeight: 24, color: 'rgba(255,255,255,0.95)', marginTop: 10, textAlign: 'center', maxWidth: 280 },

  // CTA
  ctaCard: { borderRadius: 32, paddingVertical: 64, paddingHorizontal: 48, alignItems: 'center' },
  ctaTitle: { fontSize: 40, fontWeight: '800', letterSpacing: -0.8, lineHeight: 46, color: colors.onPrimary, textAlign: 'center' },
  ctaLead: { fontSize: 17, color: 'rgba(255,255,255,0.95)', marginTop: 14, textAlign: 'center' },
  ctaBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', marginTop: 30 },
  ctaBtnLight: { backgroundColor: colors.surface, paddingVertical: 16, paddingHorizontal: 30, borderRadius: radii.md },
  ctaBtnLightText: { fontSize: 16, fontWeight: '800', color: '#F2802E' },
  ctaBtnGhost: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: radii.md,
  },
  ctaBtnGhostText: { fontSize: 16, fontWeight: '800', color: colors.onPrimary },

  // FOOTER
  footer: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: '#FFF1E6' },
  footerInner: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 18,
  },
  footerLinks: { flexDirection: 'row', gap: 28, flexWrap: 'wrap' },
  copyright: { fontSize: 13, color: colors.mutedLight },
});
