import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Lock, Mail, MailCheck } from 'lucide-react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { BrandMark } from '@/components/BrandMark';
import { signUpWithPassword } from '@/services/auth';
import { colors } from '@/theme';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await signUpWithPassword(email, password);
      if (result.status === 'signed_in') {
        router.replace('/onboarding');
        return;
      }

      setPassword('');
      setConfirmationEmail(result.email);
    } catch (error) {
      Alert.alert('Đăng ký thất bại', error instanceof Error ? error.message : 'Thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (confirmationEmail) {
    return (
      <Screen>
        <BrandMark size={52} />
        <View style={styles.confirmationCard}>
          <View style={styles.confirmationIcon}>
            <MailCheck color={colors.primaryDark} size={34} />
          </View>
          <Text style={styles.confirmationTitle}>Kiểm tra email của bạn</Text>
          <Text style={styles.confirmationText}>
            F-Love đã gửi liên kết xác nhận đến{' '}
            <Text style={styles.confirmationEmail}>{confirmationEmail}</Text>.
          </Text>
          <Text style={styles.confirmationHint}>
            Hãy mở liên kết trong email để xác nhận tài khoản. Onboarding chỉ bắt đầu sau khi bạn đăng nhập thành công.
          </Text>
        </View>

        <Button onPress={() => router.replace('/login')}>Đến trang đăng nhập</Button>
        <Button variant="secondary" onPress={() => setConfirmationEmail(null)}>Dùng email khác</Button>
      </Screen>
    );
  }

  return (
    <Screen>
      <BrandMark size={52} />
      <View style={styles.header}>
        <Text style={styles.title}>Tạo tài khoản</Text>
        <Text style={styles.subtitle}>Tham gia cộng đồng F-Love bằng email của bạn.</Text>
      </View>

      <TextField
        label="Email"
        placeholder="ban@email.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        icon={<Mail color={colors.primaryDark} size={18} />}
      />
      <TextField
        label="Mật khẩu"
        placeholder="••••••••"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        icon={<Lock color={colors.primaryDark} size={18} />}
      />

      <Button disabled={isSubmitting} onPress={handleSubmit}>Tạo tài khoản</Button>

      <Link href="/login" style={styles.link}>
        <Text style={styles.linkText}>Đã có tài khoản? </Text>
        <Text style={styles.linkAccent}>Đăng nhập</Text>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6, marginTop: 8, marginBottom: 8 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: colors.muted, fontSize: 14 },
  confirmationCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    marginTop: 12,
    padding: 24,
  },
  confirmationIcon: {
    alignItems: 'center',
    backgroundColor: colors.surfaceTint,
    borderRadius: 999,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  confirmationTitle: { color: colors.text, fontSize: 23, fontWeight: '800', textAlign: 'center' },
  confirmationText: { color: colors.textSoft, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  confirmationEmail: { color: colors.primaryText, fontWeight: '700' },
  confirmationHint: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  link: { textAlign: 'center', marginTop: 10 },
  linkText: { color: colors.textSoft, fontSize: 14 },
  linkAccent: { color: colors.primaryText, fontWeight: '700', fontSize: 14 },
});
