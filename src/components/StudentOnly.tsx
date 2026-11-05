import React from 'react';
import { View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { colors, fonts } from '@/theme';
import { Box, Button, H3, P, Row, Small } from './ui';

/** Girişten sonra kullanıcının kaldığı sayfaya dönmesi için adres. */
export function loginHref(back?: string) {
  return back && back !== '/' ? `/giris?sonra=${encodeURIComponent(back)}` : '/giris';
}

/**
 * Sadece doğrulanmış öğrencinin yapabildiği bir işlemin yerine gösterilen kart.
 * Misafire kayıt/giriş, doğrulaması dolmuş öğrenciye yenileme önerir.
 * Kullanıcı zaten öğrenciyse children'ı (asıl işlemi) gösterir.
 */
export function StudentOnly({ what, children }: { what: string; children: React.ReactNode }) {
  const { access } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  if (access === 'student') return <>{children}</>;

  if (access === 'owner') {
    return (
      <Box bg={colors.paper} style={{ marginBottom: 12 }}>
        <H3 style={{ marginBottom: 4 }}>🔒 Mekan hesabıyla yapılamaz</H3>
        <P style={{ fontSize: 14, marginBottom: 10 }}>
          {what[0].toLocaleUpperCase('tr') + what.slice(1)} sadece doğrulanmış öğrencilere açık. Mekan hesapları puan veremez
          ve kampanya kodu alamaz.
        </P>
        <Button small variant="secondary" title="Mekan paneline git" onPress={() => router.push('/panel')} style={{ alignSelf: 'flex-start' }} />
      </Box>
    );
  }

  if (access === 'expired') {
    return (
      <Box bg={colors.orangeSoft} style={{ marginBottom: 12 }}>
        <H3 style={{ marginBottom: 4 }}>🔒 Doğrulaman yenilenmeli</H3>
        <P style={{ fontSize: 14, marginBottom: 10 }}>
          {what[0].toLocaleUpperCase('tr') + what.slice(1)} için yıllık öğrenci doğrulamanı yenilemen gerekiyor. Okul
          adresine gelen kodla 1 dakika sürer.
        </P>
        <Button small title="DOĞRULAMAYI YENİLE" onPress={() => router.push('/dogrulama?mod=yenile')} style={{ alignSelf: 'flex-start' }} />
      </Box>
    );
  }

  return (
    <Box bg={colors.paper} style={{ marginBottom: 12 }}>
      <H3 style={{ marginBottom: 4 }}>🔒 Öğrencilere özel</H3>
      <P style={{ fontSize: 14, marginBottom: 10 }}>
        {what[0].toLocaleUpperCase('tr') + what.slice(1)} için okul e-postanla doğrulanmış bir öğrenci hesabı gerekiyor.
      </P>
      <Row style={{ gap: 10, flexWrap: 'wrap' }}>
        <Button small variant="accent" title="KAYIT OL" onPress={() => router.push('/kayit')} />
        <Button small variant="secondary" title="Giriş yap" onPress={() => router.push(loginHref(pathname))} />
      </Row>
    </Box>
  );
}

/** Misafir ya da doğrulaması dolmuş kullanıcı için sayfa üstünde ince bilgi şeridi. */
export function AccessStrip() {
  const { access } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  if (access === 'student' || access === 'pending') return null;
  if (access === 'owner') {
    return (
      <Box bg={colors.greenSoft} style={{ marginBottom: 16 }} padded={false}>
        <Row style={{ padding: 12, gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 200 }}>
            <Small style={{ fontFamily: fonts.pixel, color: colors.ink, letterSpacing: 1 }}>MEKAN HESABIYLA GEZİYORSUN</Small>
            <Small style={{ color: colors.ink, marginTop: 2 }}>
              Öğrencilerin gördüğü sayfaları görüyorsun. Puan verme ve kod alma kapalı.
            </Small>
          </View>
          <Button small title="PANEL" onPress={() => router.push('/panel')} />
        </Row>
      </Box>
    );
  }
  const expired = access === 'expired';
  return (
    <Box bg={expired ? colors.orangeSoft : colors.blueSoft} style={{ marginBottom: 16 }} padded={false}>
      <Row style={{ padding: 12, gap: 12, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Small style={{ fontFamily: fonts.pixel, color: colors.ink, letterSpacing: 1 }}>
            {expired ? 'DOĞRULAMAN DOLDU' : 'MİSAFİR OLARAK GEZİYORSUN'}
          </Small>
          <Small style={{ color: colors.ink, marginTop: 2 }}>
            {expired
              ? 'Puan vermek ve kampanya kodu almak için yıllık doğrulamanı yenile.'
              : 'Her şeyi görebilirsin. Kampanya kodu almak ve puan vermek için öğrenci hesabı aç.'}
          </Small>
        </View>
        <Button
          small
          variant={expired ? 'primary' : 'accent'}
          title={expired ? 'YENİLE' : 'KAYIT OL'}
          onPress={() => router.push(expired ? '/dogrulama?mod=yenile' : '/kayit')}
        />
        {!expired ? (
          <Button small variant="secondary" title="Giriş" onPress={() => router.push(loginHref(pathname))} />
        ) : null}
      </Row>
    </Box>
  );
}
