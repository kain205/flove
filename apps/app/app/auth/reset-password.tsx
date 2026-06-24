import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { supabase } from '@/lib/supabase';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function ResetPasswordScreen() {
  const handledCodeRef = useRef<string | null>(null);
  const params = useLocalSearchParams<{
    code?: string | string[];
    error?: string | string[];
    error_description?: string | string[];
  }>();
  const [password, setPassword] = useState('');
  const [isPreparingSession, setIsPreparingSession] = useState(Boolean(firstParam(params.code)));

  useEffect(() => {
    const prepareRecoverySession = async () => {
      const code = firstParam(params.code);
      const oauthError = firstParam(params.error_description) ?? firstParam(params.error);

      if (oauthError) {
        throw new Error(oauthError);
      }

      if (code) {
        if (handledCodeRef.current === code) return;
        handledCodeRef.current = code;

        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      }
    };

    prepareRecoverySession()
      .catch(error => {
        Alert.alert('Liên kết không hợp lệ', error.message);
        router.replace('/login');
      })
      .finally(() => setIsPreparingSession(false));
  }, [params.code, params.error, params.error_description]);

  const handleUpdate = async () => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      Alert.alert('Không đổi được mật khẩu', error.message);
      return;
    }
    router.replace('/ai-picks');
  };

  if (isPreparingSession) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Screen>
      <TextField label="Mật khẩu mới" secureTextEntry value={password} onChangeText={setPassword} />
      <Button onPress={handleUpdate}>Cập nhật mật khẩu</Button>
    </Screen>
  );
}
