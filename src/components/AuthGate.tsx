import React, { useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Banner, Box, Button, H2, Loading, P, Screen } from './ui';

/**
 * Oturum ve profil durumuna göre karar veren ortak kapı.
 * - Hazır değilse: yükleniyor
 * - Oturum var ama profil yüklenemediyse: hata + "Tekrar dene" / "Çıkış yap"
 * - allowGuest: misafir ve doğrulaması dolmuş kullanıcı da içeri girer (gezinme
 *   ekranları). Kod alma / puan verme gibi işlemleri ekranlar ayrıca kilitler.
 * - allowGuest yoksa: oturum yoksa giriş; doğrulama dolmuşsa yıllık doğrulama.
 * - Hesabı henüz doğrulanmamışsa doğrulama ekranı, karakteri yoksa karakter ekranı.
 * Hepsi tamamsa children'ı gösterir (verilmediyse Keşfet'e yönlendirir).
 */
export function AuthGate({ children, allowGuest = false }: { children?: React.ReactNode; allowGuest?: boolean }) {
  const { ready, session, profile, access, profileError, refreshProfile, recovery } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!ready || (session && !profile && !profileError)) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (session && !profile && profileError) {
    return (
      <Screen>
        <Box style={{ marginTop: 40 }}>
          <H2 style={{ marginBottom: 8 }}>Bağlanılamadı</H2>
          <Banner kind="error" text={profileError} />
          <P style={{ fontSize: 14, marginBottom: 14 }}>
            İnternet bağlantını kontrol edip tekrar dene. Sorun sürerse çıkış yapıp yeniden giriş yapabilirsin.
          </P>
          <View style={{ gap: 10 }}>
            <Button
              title="TEKRAR DENE"
              loading={busy}
              onPress={async () => {
                setBusy(true);
                await refreshProfile();
                setBusy(false);
              }}
            />
            <Button small variant="secondary" title="Çıkış yap" onPress={() => api.signOut()} />
          </View>
        </Box>
      </Screen>
    );
  }

  // Şifre belirleme linkiyle gelindiyse önce yeni şifre
  if (session && recovery) return <Redirect href="/sifre" />;

  if (!session) return allowGuest ? <>{children ?? <Redirect href="/kesfet" />}</> : <Redirect href="/giris" />;
  // Mekan sahibi: gezinme ekranlarına girebilir; ana sayfası panel.
  if (access === 'owner') {
    if (!allowGuest || !children) return <Redirect href="/panel" />;
    return <>{children}</>;
  }
  if (access === 'pending') {
    return <Redirect href={`/dogrulama?mod=kayit&email=${encodeURIComponent(profile?.email ?? session.email)}`} />;
  }
  if (access === 'expired' && !allowGuest) return <Redirect href="/dogrulama?mod=yenile" />;
  if (!profile?.avatar || Object.keys(profile.avatar).length === 0) return <Redirect href="/avatar?ilk=1" />;
  return children ? <>{children}</> : <Redirect href="/kesfet" />;
}
