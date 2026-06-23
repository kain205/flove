import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
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
      router.replace('/profile');
    } catch (error) {
      Alert.alert('Dang ky that bai', error instanceof Error ? error.message : 'Thu lai sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen>
      <TextField label="FPT email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextField label="Password" secureTextEntry value={password} onChangeText={setPassword} />
      <Button disabled={isSubmitting} onPress={handleSubmit}>Tao tai khoan</Button>
      <Link href="/login" style={styles.link}>Da co tai khoan? Dang nhap</Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: {
    color: colors.primaryDark,
    fontWeight: '700',
    textAlign: 'center',
  },
});
