import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Mail } from 'lucide-react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
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
      Alert.alert('Dang nhap that bai', error instanceof Error ? error.message : 'Thu lai sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Mail color={colors.primary} size={32} />
        <Text style={styles.title}>F-Love</Text>
        <Text style={styles.subtitle}>AI-curated dating for FPT students.</Text>
      </View>
      <TextField label="FPT email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextField label="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Button disabled={isSubmitting} onPress={handleSubmit}>Dang nhap</Button>
      <Button variant="secondary" onPress={() => void signInWithGoogle().catch(error => Alert.alert('Google OAuth', error.message))}>
        Tiep tuc voi Google
      </Button>
      <Link href="/signup" style={styles.link}>Chua co tai khoan? Dang ky</Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 8,
    paddingTop: 40,
    paddingBottom: 24,
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
  },
  link: {
    color: colors.primaryDark,
    fontWeight: '700',
    textAlign: 'center',
  },
});
