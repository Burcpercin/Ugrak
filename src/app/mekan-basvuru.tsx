import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { api, errorMessage } from '@/lib/api';
import { AuthLayout } from '@/components/AuthLayout';
import { Logo } from '@/components/Brand';
import { Banner, Box, Button, Field, H2, P, Small } from '@/components/ui';
import { colors } from '@/theme';

/**
 * Mekan sahiplerinin Uğrak'a katılma başvurusu. Giriş gerekmez.
 * Başvuru admin paneline düşer; admin görüşüp onaylayınca mekan açılır ve
 * sahibine şifre belirleme maili gider.
 * Veritabanı: alan uzunlukları sınırlı, aynı telefon/e-posta 24 saatte bir.
 */
export default function MekanBasvuru() {
  const router = useRouter();
  const [f, setF] = useState({ venue_name: '', contact_name: '', phone: '', email: '', district: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  const phoneDigits = f.phone.replace(/[^\d+]/g, '');
  const errors = {
    venue_name: f.venue_name.trim().length < 2 ? 'Mekanın adını yaz.' : f.venue_name.trim().length > 80 ? 'En fazla 80 karakter.' : null,
    contact_name: f.contact_name.trim().length < 2 ? 'Adını yaz.' : f.contact_name.trim().length > 60 ? 'En fazla 60 karakter.' : null,
    phone: phoneDigits.length < 7 || phoneDigits.length > 20 ? 'Telefon numaranı kontrol et.' : null,
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()) ? 'Geçerli bir e-posta yaz.' : null,
    district: f.district.trim().length > 40 ? 'En fazla 40 karakter.' : null,
    note: f.note.length > 500 ? `En fazla 500 karakter (${f.note.length}).` : null,
  };
  const valid = Object.values(errors).every((e) => !e);

  async function submit() {
    setTouched(true);
    setError(null);
    if (!valid) return;
    setBusy(true);
    try {
      await api.submitApplication({
        venue_name: f.venue_name,
        contact_name: f.contact_name,
        phone: f.phone,
        email: f.email,
        district: f.district || null,
        note: f.note || null,
      });
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthLayout>
        <Box bg={colors.greenSoft}>
          <H2 style={{ marginBottom: 6 }}>Başvurun alındı</H2>
          <P style={{ fontSize: 14, marginBottom: 12 }}>
            Teşekkürler! Uğrak ekibi en kısa sürede {f.phone} numarasından ya da {f.email.trim()} adresinden sana ulaşacak.
            Onaylanınca bu e-postaya şifre belirleme linki gelecek.
          </P>
          <Button title="KEŞFET’E DÖN" onPress={() => router.replace('/kesfet')} />
        </Box>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <View style={{ marginBottom: 14 }}>
        <Logo size={28} />
      </View>
      <Box>
        <H2 style={{ marginBottom: 4 }}>Mekanını Uğrak’a ekle</H2>
        <P style={{ fontSize: 14, marginBottom: 14 }}>
          Öğrencilere kampanya sunmak ve puanlarını görmek için başvur. Ekibimiz seninle görüşüp mekanını açacak; ücretsiz.
        </P>
        {error ? <Banner kind="error" text={error} /> : null}
        <Field label="Mekanın adı" value={f.venue_name} onChangeText={set('venue_name')} maxLength={80} error={touched ? errors.venue_name : null} />
        <Field label="Adın soyadın" value={f.contact_name} onChangeText={set('contact_name')} maxLength={60} autoComplete="name" error={touched ? errors.contact_name : null} />
        <Field
          label="Telefon"
          placeholder="05xx xxx xx xx"
          value={f.phone}
          onChangeText={set('phone')}
          keyboardType="phone-pad"
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          error={touched ? errors.phone : null}
        />
        <Field
          label="İşletme e-postası"
          hint="Onaylanınca mekan hesabın bu adrese açılır. Öğrenci (.edu) adresi kullanma."
          value={f.email}
          onChangeText={set('email')}
          autoCapitalize="none"
          keyboardType="email-address"
          inputMode="email"
          autoComplete="email"
          maxLength={120}
          error={touched ? errors.email : null}
        />
        <Field label="Semt (isteğe bağlı)" placeholder="ör. Büyükçekmece" value={f.district} onChangeText={set('district')} maxLength={40} error={touched ? errors.district : null} />
        <Field
          label="Not (isteğe bağlı)"
          placeholder="Hangi kampüse yakınsınız, öğrencilere ne sunmak istersiniz?"
          value={f.note}
          onChangeText={set('note')}
          multiline
          maxLength={500}
          style={{ minHeight: 90, textAlignVertical: 'top' }}
          error={touched ? errors.note : null}
        />
        <Button title="BAŞVURUYU GÖNDER" variant="accent" onPress={submit} loading={busy} />
        <Small style={{ marginTop: 12 }}>
          Bilgilerin sadece başvurunu değerlendirmek ve seninle iletişime geçmek için kullanılır (KVKK).
        </Small>
      </Box>
    </AuthLayout>
  );
}
