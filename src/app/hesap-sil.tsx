import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { guestStore } from '@/lib/guestStore';
import { AuthLayout } from '@/components/AuthLayout';
import { Banner, Box, Button, Field, H2, Loading, P, Small } from '@/components/ui';
import { colors } from '@/theme';

/**
 * KVKK m.11 — hesabı ve kişisel verileri silme.
 * Şifre tekrar sorulur ve "SİL" yazılması istenir (yanlışlıkla ya da açık
 * unutulmuş bir oturumla silinmesin). Mekan ve admin hesapları buradan silinemez.
 */
export default function HesapSil() {
  const router = useRouter();
  const { ready, session, profile } = useAuth();
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!ready) {
    return (
      <AuthLayout>
        <Loading />
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout>
        <Box>
          <H2 style={{ marginBottom: 6 }}>Hesabın silindi</H2>
          <P style={{ fontSize: 14, marginBottom: 12 }}>
            Profilin, yorumların, favorilerin ve kampanya kodların kalıcı olarak silindi. Uğrak’ı misafir olarak kullanmaya
            devam edebilirsin.
          </P>
          <Button title="KEŞFET’E DÖN" onPress={() => router.replace('/kesfet')} />
        </Box>
      </AuthLayout>
    );
  }

  if (!session || !profile) {
    return (
      <AuthLayout>
        <Box>
          <H2 style={{ marginBottom: 6 }}>Önce giriş yap</H2>
          <P style={{ fontSize: 14, marginBottom: 12 }}>Hesabını silmek için silmek istediğin hesapla giriş yapmalısın.</P>
          <Button title="GİRİŞ YAP" onPress={() => router.replace('/giris?sonra=%2Fhesap-sil')} />
        </Box>
      </AuthLayout>
    );
  }

  if (profile.role !== 'student') {
    return (
      <AuthLayout>
        <Box>
          <H2 style={{ marginBottom: 6 }}>Bu hesap buradan silinemez</H2>
          <P style={{ fontSize: 14, marginBottom: 12 }}>
            Mekan ve admin hesapları, bağlı mekanlar sahipsiz kalmasın diye uygulamadan silinemez. Hesabını kapatmak için Uğrak
            ekibiyle iletişime geç.
          </P>
          <Button variant="secondary" title="Geri" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        </Box>
      </AuthLayout>
    );
  }

  async function submit() {
    setError(null);
    if (confirm.trim().toLocaleUpperCase('tr') !== 'SİL') {
      setError('Onaylamak için kutuya büyük harflerle SİL yaz.');
      return;
    }
    if (!pw) {
      setError('Şifreni gir.');
      return;
    }
    setBusy(true);
    try {
      await api.deleteAccount(pw);
      await guestStore.clearFavorites();
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <Box bg={colors.redSoft}>
        <H2 style={{ marginBottom: 6 }}>Hesabımı sil</H2>
        <P style={{ fontSize: 14, marginBottom: 8 }}>
          <P style={{ fontWeight: '700', fontSize: 14 }}>{profile.email}</P> hesabı ve şu veriler kalıcı olarak silinir:
        </P>
        <P style={{ fontSize: 14 }}>• Profil, takma ad ve karakterin</P>
        <P style={{ fontSize: 14 }}>• Mekanlara verdiğin puanlar ve yorumlar</P>
        <P style={{ fontSize: 14 }}>• Favorilerin ve kampanya kodların</P>
        <P style={{ fontSize: 14, marginTop: 8, fontWeight: '700' }}>Bu işlem geri alınamaz.</P>
      </Box>
      <Box style={{ marginTop: 16 }}>
        {error ? <Banner kind="error" text={error} /> : null}
        <Field label="Şifren" placeholder="••••••••" value={pw} onChangeText={setPw} secureTextEntry autoComplete="password" />
        <Field
          label="Onay için SİL yaz"
          placeholder="SİL"
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="characters"
          onSubmitEditing={submit}
        />
        <View style={{ gap: 10 }}>
          <Button title="HESABIMI KALICI OLARAK SİL" variant="danger" onPress={submit} loading={busy} />
          <Button small variant="secondary" title="Vazgeç" onPress={() => (router.canGoBack() ? router.back() : router.replace('/profil'))} />
        </View>
        <Small style={{ marginTop: 12 }}>Şifreni unuttuysan önce “Şifremi unuttum” ile yeni şifre belirle.</Small>
      </Box>
    </AuthLayout>
  );
}
