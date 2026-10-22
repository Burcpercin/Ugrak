import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { Loading, Screen } from '@/components/ui';

// Giriş noktası: kullanıcının durumuna göre doğru ekrana yönlendirir.
export default function Index() {
  const { ready, session, profile, verified } = useAuth();
  if (!ready || (session && !profile)) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (!session) return <Redirect href="/giris" />;
  if (!verified) return <Redirect href="/dogrulama?mod=yenile" />;
  if (!profile?.avatar || Object.keys(profile.avatar).length === 0) return <Redirect href="/avatar?ilk=1" />;
  return <Redirect href="/kesfet" />;
}
