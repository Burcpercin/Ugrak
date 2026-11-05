import React, { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, errorMessage } from '@/lib/api';
import { AuthLayout } from '@/components/AuthLayout';
import { Logo } from '@/components/Brand';
import { DemoInbox } from '@/components/DemoInbox';
import { Banner, Box, Button, Field, H2, P, Small } from '@/components/ui';

/**
 * Şifremi unuttum: e-postaya şifre belirleme linki gönderir.
 * Güvenlik: adres kayıtlı olsun olmasın aynı mesaj gösterilir; böylece
 * bu ekrandan hangi adreslerin üye olduğu öğrenilemez.
 */
export default function SifremiUnuttum() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await api.requestPasswordReset(email);
      setSent(email.trim().toLowerCase());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <View style={{ marginBottom: 14 }}>
        <Logo size={28} />
      </View>
      <Box>
        <H2 style={{ marginBottom: 4 }}>Şifremi unuttum</H2>
        <P style={{ fontSize: 14, marginBottom: 14 }}>
          Hesabının e-posta adresini yaz; şifreni yeniden belirlemen için bir link gönderelim. Mekan hesapları da buradan
          şifre alabilir.
        </P>
        {error ? <Banner kind="error" text={error} /> : null}
        {sent ? (
          <Banner
            kind="ok"
            text={`Bu adres kayıtlıysa ${sent} adresine şifre belirleme linki gönderildi. Gelen kutunu ve spam klasörünü kontrol et; link kısa süre geçerlidir.`}
          />
        ) : null}
        <Field
          label="E-posta"
          placeholder="ornek@ogr.universite.edu.tr"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          inputMode="email"
          onSubmitEditing={submit}
        />
        <Button title={sent ? 'TEKRAR GÖNDER' : 'LİNK GÖNDER'} onPress={submit} loading={busy} disabled={!email.trim()} />
        <Button small variant="secondary" title="Girişe dön" onPress={() => router.replace('/giris')} style={{ marginTop: 10 }} />
        <Small style={{ marginTop: 12 }}>Uğrak senden e-postayla asla şifre istemez; linke dokunup şifreni uygulamada belirlersin.</Small>
      </Box>
      {sent ? (
        <View style={{ marginTop: 18 }}>
          <DemoInbox email={sent} kind="reset" />
        </View>
      ) : null}
    </AuthLayout>
  );
}
