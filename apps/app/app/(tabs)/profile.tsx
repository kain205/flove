import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { loadCurrentProfile, saveProfile } from '@/services/profile';
import { signOut } from '@/services/auth';
import { colors } from '@/theme';

export default function ProfileScreen() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ['profile'], queryFn: loadCurrentProfile });
  const profile = profileQuery.data;
  const [name, setName] = useState(profile?.name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');

  const handleSave = async () => {
    try {
      await saveProfile({
        ...profile,
        name,
        bio,
        interests: profile?.interests?.length ? profile.interests : ['Coding', 'Coffee', 'Music'],
        personalityTags: profile?.personalityTags?.length ? profile.personalityTags : ['Chill'],
        datingGoals: profile?.datingGoals?.length ? profile.datingGoals : ['Coffee dates'],
        preferredVibes: profile?.preferredVibes ?? [],
      });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      Alert.alert('Saved', 'Profile updated.');
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Try again later.');
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>Profile</Text>
      <TextField label="Name" value={name} onChangeText={setName} />
      <TextField label="Bio" value={bio} onChangeText={setBio} multiline />
      <Button onPress={handleSave}>Save profile</Button>
      <Button variant="secondary" onPress={() => void signOut()}>Sign out</Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
});
