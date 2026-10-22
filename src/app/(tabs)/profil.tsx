import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api, demoTools, errorMessage, isDemo } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { ReviewItem } from '@/lib/types';
import { universityById } from '@/lib/universities';
import { useVenues } from '@/lib/useVenues';
import { Avatar } from '@/components/Avatar';
import { Badge, Banner, Box, Button, Divider, H2, H3, P, Row, ScoreTile, Screen, Small } from '@/components/ui';
import { colors } from '@/theme';

export default function Profil() {
  const router = useRouter();
  const { profile, daysLeft, refreshProfile } = useAuth();
  const { venues, favorites } = useVenues();
  const [reviews, setReviews] = useState<(ReviewItem & { venue_name: string })[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const uni = universityById(profile?.university_id);

  useFocusEffect(
    useCallback(() => {
      api.myReviews().then(setReviews).catch(() => setReviews([]));
    }, []),
  );

  if (!profile) return null;

  const until = profile.verified_at
    ? new Date(new Date(profile.verified_at).getTime() + 365 * 24 * 3600 * 1000).toLocaleDateString('tr-TR')
    : '—';
  const favVenues = (venues ?? []).filter((v) => favorites.includes(v.id));

  return (
    <Screen>
      <Box>
        <Row style={{ gap: 14, alignItems: 'flex-start' }}>
          <Avatar config={profile.avatar} size={78} framed />
          <View style={{ flex: 1 }}>
            <H2>{profile.display_name}</H2>
            <Small numberOfLines={1}>{profile.email}</Small>
            <P style={{ fontSize: 14, marginTop: 2 }}>{uni?.name ?? '—'}</P>
            <View style={{ marginTop: 6 }}>
              <Badge bg={colors.green} fg="#fff" text="✓ DOĞRULANMIŞ ÖĞRENCİ" />
            </View>
          </View>
        </Row>
        <Divider />
        <Small style={{ color: colors.ink }}>
          Öğrenci doğrulaman {until} tarihine kadar geçerli ({daysLeft} gün). Süre dolunca okul adresine gelen kodla
          yenilersin.
        </Small>
        <Button
          small
          variant="secondary"
          title="Karakterimi düzenle"
          onPress={() => router.push('/avatar')}
          style={{ marginTop: 12, alignSelf: 'flex-start' }}
        />
      </Box>

      <H3 style={{ marginTop: 22, marginBottom: 8 }}>Favorilerim ({favVenues.length})</H3>
      {favVenues.length === 0 ? (
        <Small>Mekan kartlarındaki ♡ ile favori ekleyebilirsin.</Small>
      ) : (
        favVenues.map((v) => (
          <Box key={v.id} onPress={() => router.push(`/mekan/${v.id}`)} style={{ marginBottom: 10 }} bg={colors.paper}>
            <Row style={{ gap: 10 }}>
              <ScoreTile value={v.stats.avg_overall} size={38} />
              <View style={{ flex: 1 }}>
                <H3 style={{ fontSize: 15 }}>{v.name}</H3>
                <Small>{v.district}</Small>
              </View>
              <Small style={{ color: colors.red, fontSize: 18 }}>♥</Small>
            </Row>
          </Box>
        ))
      )}

      <H3 style={{ marginTop: 22, marginBottom: 8 }}>Yorumlarım ({reviews.length})</H3>
      {reviews.length === 0 ? (
        <Small>Henüz yorum yapmadın. Bir mekana gidip 4 kriterde puan ver.</Small>
      ) : (
        reviews.map((r) => (
          <Box key={r.id} onPress={() => router.push(`/mekan/${r.venue_id}`)} style={{ marginBottom: 10 }} bg={colors.paper}>
            <Row style={{ gap: 10, alignItems: 'flex-start' }}>
              <ScoreTile value={(r.price + r.study + r.portion + r.vibe) / 4} size={38} />
              <View style={{ flex: 1 }}>
                <H3 style={{ fontSize: 15 }}>{r.venue_name}</H3>
                <Small numberOfLines={2}>{r.comment || 'Yorum yazılmamış, sadece puan.'}</Small>
              </View>
            </Row>
          </Box>
        ))
      )}

      <H3 style={{ marginTop: 22, marginBottom: 8 }}>Hesap</H3>
      <Box bg={colors.paper}>
        <Pressable onPress={() => router.push('/kvkk')}>
          <P style={{ color: colors.blue, fontWeight: '700' }}>KVKK Aydınlatma Metni</P>
        </Pressable>
        <Small style={{ marginTop: 4 }}>
          Verilerinin silinmesini istersen hesap ayarlarından talep oluşturabilirsin (V2).
        </Small>
        <Button
          small
          variant="danger"
          title="Çıkış yap"
          onPress={async () => {
            await api.signOut();
            router.replace('/giris');
          }}
          style={{ marginTop: 12, alignSelf: 'flex-start' }}
        />
      </Box>

      {isDemo ? (
        <View style={{ marginTop: 22 }}>
          <Banner kind="demo" title="SUNUM ARAÇLARI (sadece demo)">
            <Small style={{ color: colors.ink, marginBottom: 8 }}>
              Yıllık doğrulamayı göstermek için doğrulama tarihini 1 yıl öncesine çeker; uygulama seni yeniden doğrulama
              ekranına yönlendirir.
            </Small>
            {msg ? <Small style={{ color: colors.red, marginBottom: 6 }}>{msg}</Small> : null}
            <Row style={{ gap: 10, flexWrap: 'wrap' }}>
              <Button
                small
                variant="accent"
                title="Doğrulamayı 1 yıl geriye al"
                onPress={async () => {
                  try {
                    await demoTools.expireVerification();
                    await refreshProfile();
                    router.replace('/dogrulama?mod=yenile');
                  } catch (e) {
                    setMsg(errorMessage(e));
                  }
                }}
              />
              <Button
                small
                variant="secondary"
                title="Demo verilerini sıfırla"
                onPress={async () => {
                  await demoTools.reset();
                  router.replace('/giris');
                }}
              />
            </Row>
          </Banner>
        </View>
      ) : null}
    </Screen>
  );
}
