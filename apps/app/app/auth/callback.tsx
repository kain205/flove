import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { supabase } from '@/lib/supabase';

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AuthCallbackScreen() {
  const handledCodeRef = useRef<string | null>(null);
  const params = useLocalSearchParams<{
    code?: string | string[];
    error?: string | string[];
    error_description?: string | string[];
  }>();

  useEffect(() => {
    const finishSignIn = async () => {
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

      router.replace('/ai-picks');
    };

    finishSignIn().catch(error => {
      Alert.alert('Không đăng nhập được', error.message);
      router.replace('/login');
    });
  }, [params.code, params.error, params.error_description]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
