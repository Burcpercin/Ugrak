import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Logo } from '@/components/Brand';
import { DemoInbox } from '@/components/DemoInbox';
import { Banner, Box, Button, Field, H2, P, Row, Screen, Small } from '@/components/ui';
import { colors } from '@/theme';

export default function Dogrulama() {
  const params = useLocalSearchParams<{ mod?: string; email?: string }>();
  const mod = params.mod === 'yenile' ? 'yenile' : 'kayit';
  return mod === 'kayit' ? <KayitDogrulama email={params.email ?? ''} /> : <YillikDogrulama />;
}

// ---------------------------------------------------------------------
// 1) Kayıttan sonra: "mailine gelen linke tıkla"
// ---------------------------------------------------------------------

function KayitDogrulama({ email }: { email: string }) {
  const router = useRouter();
  const { session, refreshProfile } = useAuth();
  const [cooldown, setCooldown] = useState(0);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Link tıklanınca oturum açılır → uygulamaya devam
  useEffect(() => {
    if (session) {
      refreshProfile().then(() => router.replace('/'));
    }
  }, [session]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    setMsg(null);
    try {
      await api.resendVerification(email);
      setCooldown(60);
      setMsg({ kind: 'ok', text: 'Doğrulama maili tekrar gönderildi.' });
    } catch (e) {
      setMsg({ kind: 'error', text: errorMessage(e) });
    }
  }

  return (
    <Screen>
      <View style={{ marginBottom: 14 }}>
        <Logo size={28} />
      </View>
      <Box>
        <H2>Mailini kontrol et</H2>
        <P style={{ marginTop: 6 }}>
          <P style={{ fontWeight: '700' }}>{email || 'Okul adresine'}</P> bir doğrulama linki gönderdik.
        </P>
        <View style={{ marginVertical: 12, gap: 6 }}>
          <Step n={1} text="Okul mail kutunu aç (Outlook / Gmail)." />
          <Step n={2} text="“Uğrak — Öğrenci adresini doğrula” mailindeki linke tıkla." />
          <Step n={3} text="Uygulamaya dön; öğrenci hesabın 1 yıl boyunca aktif olur." />
        </View>

        {msg ? <Banner kind={msg.kind} text={msg.text} /> : null}

        <Row style={{ gap: 10, flexWrap: 'wrap' }}>
          <Button
            small
            variant="secondary"
            title={cooldown > 0 ? `Tekrar gönder (${cooldown})` : 'Maili tekrar gönder'}
            disabled={cooldown > 0 || !email}
            onPress={resend}
          />
          <Button small title="Doğruladım, giriş yap" onPress={() => router.replace('/giris')} />
        </Row>
        <Small style={{ marginTop: 10 }}>Mail gelmediyse gereksiz/spam klasörüne de bak.</Small>
      </Box>

      <View style={{ marginTop: 18 }}>
        <DemoInbox email={email} kind="signup" />
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------------
// 2) Yıllık yeniden doğrulama: okul adresine 6 haneli kod
// ---------------------------------------------------------------------

function YillikDogrulama() {
  const router = useRouter();
  const { session, profile, verified, refreshProfile } = useAuth();
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!session) router.replace('/giris');
  }, [session]);

  const email = profile?.email ?? session?.email ?? '';

  async function send() {
    setMsg(null);
    setBusy(true);
    try {
      await api.requestReverify(email);
      setSent(true);
      setMsg({ kind: 'ok', text: `${email} adresine 6 haneli kod gönderildi.` });
    } catch (e) {
      setMsg({ kind: 'error', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  async function confirm(c = code) {
    setMsg(null);
    setBusy(true);
    try {
      await api.confirmReverify(email, c);
      await refreshProfile();
      router.replace('/');
    } catch (e) {
      setMsg({ kind: 'error', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  if (verified) {
    return (
      <Screen>
        <Box>
          <H2>Doğrulaman güncel</H2>
          <P style={{ marginVertical: 8 }}>Öğrenci doğrulaman hâlâ geçerli, bir şey yapmana gerek yok.</P>
          <Button title="Uygulamaya dön" onPress={() => router.replace('/')} />
        </Box>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ marginBottom: 14 }}>
        <Logo size={28} />
      </View>
      <Box bg={colors.orangeSoft}>
        <H2>Yıllık doğrulama</H2>
        <P style={{ marginTop: 6 }}>
          Uğrak’ta öğrencilik her yıl yeniden doğrulanır. Böylece mezun olan ya da okulu bırakan hesaplar puan veremez
          ve öğrenci kampanyalarını kullanamaz.
        </P>
        {profile?.verified_at ? (
          <Small style={{ marginTop: 6, color: colors.ink }}>
            Son doğrulama: {new Date(profile.verified_at).toLocaleDateString('tr-TR')}
          </Small>
        ) : null}
      </Box>

      <Box style={{ marginTop: 16 }}>
        {msg ? <Banner kind={msg.kind} text={msg.text} /> : null}
        <Field label="Okul e-postan" value={email} editable={false} />
        {!sent ? (
          <Button title="KOD GÖNDER" onPress={send} loading={busy} />
        ) : (
          <>
            <Field
              label="6 haneli kod"
              placeholder="000000"
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={6}
            />
            <Button title="DOĞRULA" variant="success" onPress={() => confirm()} loading={busy} disabled={code.length !== 6} />
            <Button small variant="secondary" title="Kodu tekrar gönder" onPress={send} style={{ marginTop: 10 }} />
          </>
        )}
        <Small style={{ marginTop: 12 }}>
          Okul mailine artık erişemiyorsan (mezuniyet vb.) hesabın görüntüleme modunda kalır.
        </Small>
      </Box>

      {sent ? (
        <View style={{ marginTop: 18 }}>
          <DemoInbox
            email={email}
            kind="otp"
            onUseCode={(c) => {
              setCode(c);
              confirm(c);
            }}
          />
        </View>
      ) : null}

      <View style={{ marginTop: 16, alignItems: 'center' }}>
        <Button small variant="secondary" title="Çıkış yap" onPress={() => api.signOut()} />
      </View>
    </Screen>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <Row style={{ gap: 10, alignItems: 'flex-start' }}>
      <View
        style={{
          width: 24,
          height: 24,
          backgroundColor: colors.blue,
          borderWidth: 2,
          borderColor: colors.ink,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Small style={{ color: '#fff', fontWeight: '700' }}>{n}</Small>
      </View>
      <P style={{ flex: 1, fontSize: 14 }}>{text}</P>
    </Row>
  );
}
