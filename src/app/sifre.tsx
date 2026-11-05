import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AuthLayout } from '@/components/AuthLayout';
import { Logo } from '@/components/Brand';
import { Banner, Box, Button, Field, H2, Loading, P, Small } from '@/components/ui';

/**
 * Yeni şifre belirleme. Şifre belirleme linkiyle gelinir (öğrencinin
 * "şifremi unuttum"u ya da admin'in açtığı mekan hesabının ilk şifresi).
 * Link oturumu açar; burada yeni şifre kaydedilir.
 */
export default function Sifre() {
  const router = useRouter();
  const { ready, session, profile, recovery, clearRecovery, refreshProfile } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  if (!ready) {
    return (
      <AuthLayout>
        <Loading />
      </AuthLayout>
    );
  }

  // Link geçersiz / süresi dolmuş ya da sayfa doğrudan açılmış
  if (!session) {
    return (
      <AuthLayout>
        <Box>
          <H2 style={{ marginBottom: 6 }}>Link geçersiz</H2>
          <P style={{ fontSize: 14, marginBottom: 12 }}>
            Şifre belirleme linkinin süresi dolmuş ya da daha önce kullanılmış olabilir. Yeni bir link iste.
          </P>
          <Button title="YENİ LİNK İSTE" onPress={() => router.replace('/sifremi-unuttum')} />
        </Box>
      </AuthLayout>
    );
  }

  const errors = {
    pw: pw.length < 8 ? 'En az 8 karakter.' : null,
    pw2: pw2 !== pw ? 'Şifreler aynı değil.' : null,
  };
  const owner = profile?.role === 'venue_owner';

  async function submit() {
    setTouched(true);
    setError(null);
    if (errors.pw || errors.pw2) return;
    setBusy(true);
    try {
      await api.updatePassword(pw);
      clearRecovery();
      await refreshProfile();
      router.replace('/');
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
        <H2 style={{ marginBottom: 4 }}>{owner ? 'Mekan hesabına hoş geldin' : 'Yeni şifre belirle'}</H2>
        <P style={{ fontSize: 14, marginBottom: 14 }}>
          {owner
            ? `${profile?.email} hesabın için bir şifre belirle. Sonra bu e-posta ve şifreyle giriş yapıp mekan panelini kullanabilirsin.`
            : `${profile?.email ?? session.email} hesabın için yeni şifreni yaz.`}
        </P>
        {error ? <Banner kind="error" text={error} /> : null}
        <Field
          label="Yeni şifre"
          placeholder="En az 8 karakter"
          value={pw}
          onChangeText={setPw}
          secureTextEntry
          autoComplete="new-password"
          error={touched ? errors.pw : null}
        />
        <Field
          label="Yeni şifre (tekrar)"
          placeholder="Şifreni tekrar yaz"
          value={pw2}
          onChangeText={setPw2}
          secureTextEntry
          autoComplete="new-password"
          error={touched ? errors.pw2 : null}
          onSubmitEditing={submit}
        />
        <Button title="ŞİFREYİ KAYDET" variant="success" onPress={submit} loading={busy} />
        {!recovery ? (
          <Button small variant="secondary" title="Vazgeç" onPress={() => router.replace('/')} style={{ marginTop: 10 }} />
        ) : null}
        <Small style={{ marginTop: 12 }}>Başka sitelerde kullandığın bir şifreyi seçme.</Small>
      </Box>
    </AuthLayout>
  );
}
