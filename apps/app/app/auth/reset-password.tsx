import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');

  const handleUpdate = async () => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      Alert.alert('Khong doi duoc mat khau', error.message);
      return;
    }
    router.replace('/ai-picks');
  };

  return (
    <Screen>
      <TextField label="Mat khau moi" secureTextEntry value={password} onChangeText={setPassword} />
      <Button onPress={handleUpdate}>Cap nhat mat khau</Button>
    </Screen>
  );
}
