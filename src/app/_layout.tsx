import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, PixelifySans_500Medium, PixelifySans_700Bold } from '@expo-google-fonts/pixelify-sans';
import { AuthProvider } from '@/lib/auth';
import { LocationProvider } from '@/lib/location';
import { Loading } from '@/components/ui';
import { colors } from '@/theme';

// Telefonda açılış ekranı (mavi zemin + pixel karakter) fontlar yüklenene kadar kalsın.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, fontError] = useFonts({ PixelifySans_500Medium, PixelifySans_700Bold });
  // Font yüklemesi takılırsa (ör. emülatör geliştirme sunucusuna ulaşamıyorsa)
  // açılış ekranında sonsuza kadar kalmayalım: 5 saniye sonra sistem fontuyla devam.
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(t);
  }, []);
  const ready = loaded || !!fontError || timedOut;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <Loading />
      </View>
    );
  }

  return (
    <AuthProvider>
      <LocationProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: Platform.OS === 'web' ? 'none' : 'default',
        }}
      />
      </LocationProvider>
    </AuthProvider>
  );
}
