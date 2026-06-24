import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Lock, Mail } from 'lucide-react-native';
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

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await signUpWithPassword(email, password);
      router.replace('/onboarding');
    } catch (error) {
      Alert.alert('Đăng ký thất bại', error instanceof Error ? error.message : 'Thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <BrandMark size={52} />
      <View style={styles.header}>
        <Text style={styles.title}>Tạo tài khoản</Text>
        <Text style={styles.subtitle}>Tham gia cộng đồng F-Love bằng email FPT của bạn.</Text>
      </View>

      <TextField
        label="Email FPT"
        placeholder="ten.sv@fpt.edu.vn"
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
  link: { textAlign: 'center', marginTop: 10 },
  linkText: { color: colors.textSoft, fontSize: 14 },
  linkAccent: { color: colors.primaryText, fontWeight: '700', fontSize: 14 },
});
