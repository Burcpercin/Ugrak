import React, { useState } from 'react';
import { View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { api, AppError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Hero } from '@/components/Brand';
import { Banner, Box, Button, Field, H2, P, Row, Screen, Small } from '@/components/ui';
import { colors } from '@/theme';

export default function Giris() {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfirmed, setNotConfirmed] = useState(false);

  async function submit() {
    setError(null);
    setNotConfirmed(false);
    if (!email.trim() || !password) {
      setError('E-posta ve şifreni gir.');
      return;
    }
    setBusy(true);
    try {
      await api.signIn(email, password);
      await refreshProfile();
      router.replace('/');
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof AppError && e.code === 'NOT_CONFIRMED') setNotConfirmed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Hero />
      <Box>
        <H2 style={{ marginBottom: 4 }}>Giriş yap</H2>
        <Small style={{ marginBottom: 14 }}>Okulunun verdiği .edu.tr adresi ve şifrenle.</Small>

        {error ? (
          <Banner kind="error" text={error}>
            {notConfirmed ? (
              <View style={{ marginTop: 8 }}>
                <Button
                  small
                  variant="secondary"
                  title="Doğrulama ekranına git"
                  onPress={() => router.push(`/dogrulama?mod=kayit&email=${encodeURIComponent(email.trim())}`)}
                />
              </View>
            ) : null}
          </Banner>
        ) : null}

        <Field
          label="Okul e-postası"
          placeholder="ad.soyad@ogr.universite.edu.tr"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          inputMode="email"
        />
        <Field
          label="Şifre"
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          onSubmitEditing={submit}
        />
        <Button title="GİRİŞ" onPress={submit} loading={busy} />
      </Box>

      <Box bg={colors.orangeSoft} style={{ marginTop: 18 }}>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <View style={{ flex: 1, minWidth: 180 }}>
            <H2 style={{ fontSize: 18 }}>Yeni misin?</H2>
            <P style={{ fontSize: 14 }}>Öğrenci mailinle 1 dakikada kayıt ol.</P>
          </View>
          <Button variant="accent" title="KAYIT OL" onPress={() => router.push('/kayit')} />
        </Row>
      </Box>

      <View style={{ marginTop: 26, alignItems: 'center', gap: 6 }}>
        <Small>Tanıtım ekranları (taslak, örnek veri):</Small>
        <Row style={{ gap: 16 }}>
          <Link href="/panel" style={{ color: colors.blue, fontWeight: '700' }}>
            Mekan paneli
          </Link>
          <Link href="/admin" style={{ color: colors.blue, fontWeight: '700' }}>
            Admin paneli
          </Link>
          <Link href="/kvkk" style={{ color: colors.blue, fontWeight: '700' }}>
            KVKK metni
          </Link>
        </Row>
      </View>
    </Screen>
  );
}
