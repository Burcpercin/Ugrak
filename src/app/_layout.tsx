import React from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, PixelifySans_500Medium, PixelifySans_700Bold } from '@expo-google-fonts/pixelify-sans';
import { AuthProvider } from '@/lib/auth';
import { Loading } from '@/components/ui';
import { colors } from '@/theme';

export default function RootLayout() {
  const [loaded] = useFonts({ PixelifySans_500Medium, PixelifySans_700Bold });

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <Loading />
      </View>
    );
  }

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: Platform.OS === 'web' ? 'none' : 'default',
        }}
      />
    </AuthProvider>
  );
}
