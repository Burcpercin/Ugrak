import React, { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { api, errorMessage } from '@/lib/api';
import { checkStudentEmail } from '@/lib/universities';
import { Logo } from '@/components/Brand';
import { Checkbox } from '@/components/Checkbox';
import { Banner, Box, Button, Field, H2, P, Row, Screen, Small } from '@/components/ui';
import { colors } from '@/theme';

export default function Kayit() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [isStudent, setIsStudent] = useState(false);
  const [kvkk, setKvkk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const check = useMemo(() => (email.includes('@') ? checkStudentEmail(email) : null), [email]);

  const errors = {
    name: !name.trim() ? 'Bir takma ad seç.' : name.trim().length > 24 ? 'En fazla 24 karakter.' : null,
    email: !check ? 'Okul e-postanı gir.' : check.ok ? null : check.reason,
    password: password.length < 8 ? 'En az 8 karakter.' : null,
    password2: password2 !== password ? 'Şifreler aynı değil.' : null,
    isStudent: !isStudent ? 'Bu beyan gerekli.' : null,
    kvkk: !kvkk ? 'Aydınlatma metnini onaylamalısın.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);

  async function submit() {
    setTouched(true);
    setError(null);
    if (!valid) return;
    setBusy(true);
    try {
      const { needsVerification } = await api.signUp({
        email,
        password,
        displayName: name,
        kvkkAccepted: kvkk,
      });
      if (needsVerification) {
        router.replace(`/dogrulama?mod=kayit&email=${encodeURIComponent(email.trim().toLowerCase())}`);
      } else {
        router.replace('/');
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const show = (k: keyof typeof errors) => (touched ? errors[k] : null);

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <Logo size={28} />
        <Link href="/giris" style={{ color: colors.blue, fontWeight: '700' }}>
          ← Girişe dön
        </Link>
      </Row>

      <Box>
        <H2>Öğrenci kaydı</H2>
        <Small style={{ marginBottom: 14 }}>
          Kayıttan sonra okul adresine bir doğrulama maili gelir. Linke tıkladığında öğrenci olduğun doğrulanır.
        </Small>

        {error ? <Banner kind="error" text={error} /> : null}

        <Field
          label="Takma ad"
          placeholder="Forumda ve yorumlarda görünen ad"
          value={name}
          onChangeText={setName}
          maxLength={24}
          error={show('name')}
        />

        <Field
          label="Okul e-postası"
          placeholder="ad.soyad@ogr.universite.edu.tr"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          inputMode="email"
          error={show('email') ?? (check && !check.ok ? check.reason : null)}
        />
        {check?.ok ? (
          <Banner kind="ok">
            <Text style={{ fontWeight: '700', color: colors.ink }}>✓ {check.university.name}</Text>
            <Small style={{ color: colors.ink }}>Kampüs: {check.university.campus_name}</Small>
          </Banner>
        ) : null}

        <Field
          label="Şifre"
          placeholder="En az 8 karakter"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          error={show('password')}
        />
        <Field
          label="Şifre (tekrar)"
          placeholder="Şifreni tekrar yaz"
          value={password2}
          onChangeText={setPassword2}
          secureTextEntry
          autoComplete="new-password"
          error={show('password2')}
        />

        <Checkbox checked={isStudent} onChange={setIsStudent}>
          <P style={{ fontSize: 14 }}>Bu adresi kullanan aktif bir öğrenciyim.</P>
          {show('isStudent') ? <Small style={{ color: colors.red }}>{show('isStudent')}</Small> : null}
        </Checkbox>

        <Checkbox checked={kvkk} onChange={setKvkk}>
          <P style={{ fontSize: 14 }}>
            <Link href="/kvkk" style={{ color: colors.blue, fontWeight: '700' }}>
              KVKK Aydınlatma Metni
            </Link>
            ’ni okudum; e-posta adresimin doğrulama ve hesap işlemleri için işlenmesini kabul ediyorum.
          </P>
          {show('kvkk') ? <Small style={{ color: colors.red }}>{show('kvkk')}</Small> : null}
        </Checkbox>

        <Button title="KAYIT OL" variant="accent" onPress={submit} loading={busy} style={{ marginTop: 4 }} />
      </Box>

      <Small style={{ marginTop: 16, textAlign: 'center' }}>
        Uğrak şimdilik sadece İstanbul’daki üniversitelerin öğrencilerine açık.
      </Small>
    </Screen>
  );
}
