import React, { useState } from 'react';
import { View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { api, AppError, DEMO_ACCOUNTS, errorMessage, isDemo } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Hero } from '@/components/Brand';
import { Banner, Box, Button, Field, H2, P, Row, Small } from '@/components/ui';
import { AuthLayout } from '@/components/AuthLayout';
import { colors } from '@/theme';

export default function Giris() {
  const router = useRouter();
  const { sonra } = useLocalSearchParams<{ sonra?: string }>();
  // Sadece uygulama içi adreslere dön ("//site.com" gibi dış adresleri reddet).
  const back = typeof sonra === 'string' && /^\/(?!\/)[\w\-/?=&%.]*$/.test(sonra) ? sonra : '/';
  const { refreshProfile, linkError, clearLinkError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfirmed, setNotConfirmed] = useState(false);

  async function submit(e = email, p = password, target?: string) {
    setError(null);
    clearLinkError();
    setNotConfirmed(false);
    if (!e.trim() || !p) {
      setError('E-posta ve şifreni gir.');
      return;
    }
    setBusy(true);
    try {
      await api.signIn(e, p);
      await refreshProfile();
      router.replace((target ?? back) as any);
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof AppError && e.code === 'NOT_CONFIRMED') setNotConfirmed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <Hero />
      <Box>
        <H2 style={{ marginBottom: 4 }}>Giriş yap</H2>
        <Small style={{ marginBottom: 14 }}>
          Öğrenciysen okulunun verdiği .edu.tr adresiyle; mekan hesabıysan işletme e-postanla.
        </Small>

        {linkError && !error ? <Banner kind="warn" text={linkError} /> : null}
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
          onSubmitEditing={() => submit()}
        />
        <Button title="GİRİŞ" onPress={() => submit()} loading={busy} />
        <Link
          href={email.trim() ? `/sifremi-unuttum?email=${encodeURIComponent(email.trim())}` : '/sifremi-unuttum'}
          style={{ color: colors.blue, fontWeight: '700', marginTop: 12, alignSelf: 'flex-start' }}
        >
          Şifremi unuttum
        </Link>
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

      <View style={{ marginTop: 16, alignItems: 'center' }}>
        <Button small variant="secondary" title="Giriş yapmadan göz at →" onPress={() => router.replace('/kesfet')} />
      </View>

      <View style={{ marginTop: 26, alignItems: 'center', gap: 6 }}>
        <Row style={{ gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link href="/mekan-basvuru" style={{ color: colors.blue, fontWeight: '700' }}>
            Mekan sahibiyim, başvur
          </Link>
          <Link href="/kvkk" style={{ color: colors.blue, fontWeight: '700' }}>
            KVKK metni
          </Link>
        </Row>
        {isDemo ? (
          <Banner kind="demo" title="DEMO HESAPLARI (sunum için)">
            <Small style={{ color: colors.ink, marginBottom: 8 }}>
              Mekan sahibi: {DEMO_ACCOUNTS.owner.email} · Admin: {DEMO_ACCOUNTS.admin.email} · şifre: {DEMO_ACCOUNTS.owner.password}
            </Small>
            <Row style={{ gap: 10, flexWrap: 'wrap' }}>
              <Button
                small
                variant="secondary"
                title="Mekan sahibi olarak gir"
                onPress={() => submit(DEMO_ACCOUNTS.owner.email, DEMO_ACCOUNTS.owner.password)}
              />
              <Button
                small
                variant="secondary"
                title="Admin olarak gir"
                onPress={() => submit(DEMO_ACCOUNTS.admin.email, DEMO_ACCOUNTS.admin.password, '/admin')}
              />
            </Row>
          </Banner>
        ) : null}
      </View>
    </AuthLayout>
  );
}
