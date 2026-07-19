import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Lock, Mail } from 'lucide-react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { BrandMark } from '@/components/BrandMark';
import { signInWithGoogle, signInWithPassword } from '@/services/auth';
import { colors } from '@/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await signInWithPassword(email, password);
      router.replace('/ai-picks');
    } catch (error) {
      Alert.alert('Đăng nhập thất bại', error instanceof Error ? error.message : 'Thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <BrandMark size={52} />
      <View style={styles.header}>
        <Text style={styles.title}>Chào mừng trở lại</Text>
        <Text style={styles.subtitle}>Đăng nhập để tiếp tục ghép đôi.</Text>
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
      <Text style={styles.forgot}>Quên mật khẩu?</Text>

      <Button disabled={isSubmitting} onPress={handleSubmit}>Đăng nhập</Button>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>hoặc</Text>
        <View style={styles.line} />
      </View>

      <Button
        variant="secondary"
        onPress={() => void signInWithGoogle().catch(error => Alert.alert('Google OAuth', error.message))}
      >
        Tiếp tục với Google
      </Button>

      <Link href="/signup" style={styles.link}>
        <Text style={styles.linkText}>Chưa có tài khoản? </Text>
        <Text style={styles.linkAccent}>Đăng ký</Text>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6, marginTop: 8, marginBottom: 8 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: colors.muted, fontSize: 14 },
  forgot: { color: colors.primaryText, fontWeight: '600', fontSize: 13, textAlign: 'right', marginTop: -6 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 6 },
  line: { flex: 1, height: 1, backgroundColor: colors.borderSoft },
  dividerText: { color: colors.mutedLight, fontSize: 12 },
  link: { textAlign: 'center', marginTop: 10 },
  linkText: { color: colors.textSoft, fontSize: 14 },
  linkAccent: { color: colors.primaryText, fontWeight: '700', fontSize: 14 },
});
