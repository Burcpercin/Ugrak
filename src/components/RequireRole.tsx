import React from 'react';
import { Redirect, usePathname, useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Box, Button, H2, Loading, P, Screen } from './ui';

/**
 * Panel sayfalarını korur. Asıl güvenlik veritabanında (RLS ve fonksiyonlar);
 * bu bileşen sadece yanlış kişiye boş/yarım ekran göstermemek için.
 * - Oturum yoksa: giriş (sonra bu sayfaya dönülür)
 * - Rolü uymuyorsa: açıklama + çıkış
 */
export function RequireRole({ role, children }: { role: 'venue_owner' | 'admin'; children: React.ReactNode }) {
  const { ready, session, profile, profileError, recovery } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!ready || (session && !profile && !profileError)) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (!session) return <Redirect href={`/giris?sonra=${encodeURIComponent(pathname)}` as any} />;
  if (recovery) return <Redirect href="/sifre" />;

  if (profile?.role !== role) {
    return (
      <Screen>
        <Box style={{ marginTop: 40 }}>
          <H2 style={{ marginBottom: 8 }}>{role === 'admin' ? 'Sadece admin' : 'Sadece mekan hesapları'}</H2>
          <P style={{ fontSize: 14, marginBottom: 14 }}>
            {role === 'admin'
              ? 'Bu sayfa Uğrak ekibi içindir.'
              : 'Bu panel, Uğrak ekibinin açtığı mekan hesapları içindir. Mekanını eklemek için başvurabilirsin.'}
            {profile?.email ? ` Şu an ${profile.email} ile giriş yaptın.` : ''}
          </P>
          {role === 'venue_owner' ? (
            <Button title="MEKAN BAŞVURUSU" variant="accent" onPress={() => router.push('/mekan-basvuru')} style={{ marginBottom: 10 }} />
          ) : null}
          <Button variant="secondary" title="Uygulamaya dön" onPress={() => router.replace('/')} style={{ marginBottom: 10 }} />
          <Button
            small
            variant="secondary"
            title="Başka hesapla giriş yap"
            onPress={async () => {
              await api.signOut();
              router.replace(`/giris?sonra=${encodeURIComponent(pathname)}` as any);
            }}
          />
        </Box>
      </Screen>
    );
  }
  return <>{children}</>;
}
