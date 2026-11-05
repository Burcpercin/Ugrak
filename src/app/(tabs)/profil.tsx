import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api, demoTools, errorMessage, isDemo } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AvatarConfig, ReviewItem, VenueListItem } from '@/lib/types';
import { universityById } from '@/lib/universities';
import { column, useLayout } from '@/lib/useLayout';
import { useVenues } from '@/lib/useVenues';
import { Avatar } from '@/components/Avatar';
import { StudentPage } from '@/components/StudentPage';
import { Badge, Banner, Box, Button, Divider, H2, H3, P, Row, ScoreTile, Small } from '@/components/ui';
import { colors } from '@/theme';

export default function Profil() {
  const router = useRouter();
  const { profile, daysLeft, refreshProfile, access, avatar, isAdmin } = useAuth();
  const { isWide } = useLayout();
  const { venues, favorites } = useVenues();
  const [reviews, setReviews] = useState<(ReviewItem & { venue_name: string; is_hidden?: boolean })[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const uni = universityById(profile?.university_id);

  useFocusEffect(
    useCallback(() => {
      if (access === 'guest' || access === 'owner') return;
      api.myReviews().then(setReviews).catch(() => setReviews([]));
    }, [access]),
  );

  const favVenues = (venues ?? []).filter((v) => favorites.includes(v.id));

  if (access === 'guest') {
    return (
      <StudentPage hasTabBar>
        <GuestProfile avatar={avatar} favVenues={favVenues} />
      </StudentPage>
    );
  }
  if (!profile) return null;

  if (access === 'owner') {
    return (
      <StudentPage hasTabBar>
        <OwnerProfile name={profile.display_name} email={profile.email} />
      </StudentPage>
    );
  }

  const until = profile.verified_at
    ? new Date(new Date(profile.verified_at).getTime() + 365 * 24 * 3600 * 1000).toLocaleDateString('tr-TR')
    : '—';
  // ----- Sol sütun: kimlik, hesap, sunum araçları -----
  const left = (
    <View style={{ gap: 18 }}>
      <Box>
        <View style={{ alignItems: isWide ? 'center' : 'flex-start', gap: 10 }}>
          <Avatar config={profile.avatar} size={isWide ? 110 : 78} framed />
          <View style={{ alignItems: isWide ? 'center' : 'flex-start' }}>
            <H2>{profile.display_name}</H2>
            <Small numberOfLines={1}>{profile.email}</Small>
            <P style={{ fontSize: 14, marginTop: 2, textAlign: isWide ? 'center' : 'left' }}>{uni?.name ?? '—'}</P>
            <View style={{ marginTop: 8 }}>
              {access === 'student' ? (
                <Badge bg={colors.green} fg="#fff" text="✓ DOĞRULANMIŞ ÖĞRENCİ" />
              ) : (
                <Badge bg={colors.orange} text="! DOĞRULAMA SÜRESİ DOLDU" />
              )}
            </View>
          </View>
        </View>
        <Divider />
        {access === 'student' ? (
          <Small style={{ color: colors.ink }}>
            Öğrenci doğrulaman {until} tarihine kadar geçerli ({daysLeft} gün). Süre dolunca okul adresine gelen kodla
            yenilersin.
          </Small>
        ) : (
          <View style={{ gap: 8 }}>
            <Small style={{ color: colors.ink }}>
              Doğrulaman {until} tarihinde doldu. Gezebilirsin; puan vermek ve kod almak için yenile.
            </Small>
            <Button small title="DOĞRULAMAYI YENİLE" onPress={() => router.push('/dogrulama?mod=yenile')} />
          </View>
        )}
        <Button
          small
          variant="secondary"
          title="Karakterimi düzenle"
          onPress={() => router.push('/avatar')}
          style={{ marginTop: 12, alignSelf: isWide ? 'stretch' : 'flex-start' }}
        />
      </Box>

      {isAdmin ? (
        <Box bg={colors.blueSoft}>
          <H3 style={{ marginBottom: 6 }}>Admin</H3>
          <Button small title="ADMİN PANELİ" onPress={() => router.push('/admin')} style={{ alignSelf: 'flex-start' }} />
        </Box>
      ) : null}

      <Box bg={colors.paper}>
        <H3 style={{ marginBottom: 6 }}>Hesap</H3>
        <Pressable onPress={() => router.push('/kvkk')}>
          <P style={{ color: colors.blue, fontWeight: '700' }}>KVKK Aydınlatma Metni</P>
        </Pressable>
        <Pressable onPress={() => router.push('/hesap-sil')} style={{ marginTop: 6 }}>
          <P style={{ color: colors.red, fontWeight: '700' }}>Hesabımı ve verilerimi sil</P>
        </Pressable>
        <Button
          small
          variant="danger"
          title="Çıkış yap"
          onPress={async () => {
            await api.signOut();
            router.replace('/kesfet');
          }}
          style={{ marginTop: 12, alignSelf: 'flex-start' }}
        />
      </Box>

      {isDemo ? (
        <Banner kind="demo" title="SUNUM ARAÇLARI (sadece demo)">
          <Small style={{ color: colors.ink, marginBottom: 8 }}>
            Yıllık doğrulamayı göstermek için doğrulama tarihini 1 yıl öncesine çeker; uygulama seni yeniden doğrulama
            ekranına yönlendirir.
          </Small>
          {msg ? <Small style={{ color: colors.red, marginBottom: 6 }}>{msg}</Small> : null}
          <View style={{ gap: 10 }}>
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
          </View>
        </Banner>
      ) : null}
    </View>
  );

  // ----- Sağ sütun: favoriler ve yorumlar -----
  const right = (
    <View style={{ gap: 26 }}>
      <View>
        <H2 style={{ marginBottom: 10 }}>Favorilerim ({favVenues.length})</H2>
        {favVenues.length === 0 ? (
          <Small>Mekan kartlarındaki ♡ ile favori ekleyebilirsin.</Small>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
            {favVenues.map((v) => (
              <View key={v.id} style={{ width: isWide ? '50%' : '100%', paddingHorizontal: 6 }}>
                <Box onPress={() => router.push(`/mekan/${v.id}`)} style={{ marginBottom: 10 }} bg={colors.paper}>
                  <Row style={{ gap: 10 }}>
                    <ScoreTile value={v.stats.avg_overall} size={40} />
                    <View style={{ flex: 1 }}>
                      <H3 style={{ fontSize: 15 }} numberOfLines={1}>
                        {v.name}
                      </H3>
                      <Small>{v.district}</Small>
                    </View>
                    <Small style={{ color: colors.red, fontSize: 18 }}>♥</Small>
                  </Row>
                </Box>
              </View>
            ))}
          </View>
        )}
      </View>

      <View>
        <H2 style={{ marginBottom: 10 }}>Yorumlarım ({reviews.length})</H2>
        {reviews.length === 0 ? (
          <Small>Henüz yorum yapmadın. Bir mekana gidip 4 kriterde puan ver.</Small>
        ) : (
          reviews.map((r) => (
            <Box key={r.id} onPress={() => router.push(`/mekan/${r.venue_id}`)} style={{ marginBottom: 10 }}>
              <Row style={{ gap: 12, alignItems: 'flex-start' }}>
                <ScoreTile value={(r.price + r.study + r.portion + r.vibe) / 4} size={40} />
                <View style={{ flex: 1 }}>
                  <Row style={{ justifyContent: 'space-between', gap: 8 }}>
                    <H3 style={{ fontSize: 15, flex: 1 }} numberOfLines={1}>
                      {r.venue_name}
                    </H3>
                    <Small>{new Date(r.updated_at).toLocaleDateString('tr-TR')}</Small>
                  </Row>
                  {r.is_hidden ? (
                    <Small style={{ color: colors.red, marginTop: 2 }}>
                      Bu yorum kurallara uymadığı için Uğrak ekibi tarafından gizlendi; başkaları görmüyor.
                    </Small>
                  ) : null}
                  <Small numberOfLines={2} style={{ color: colors.ink, marginTop: 2 }}>
                    {r.comment || 'Yorum yazılmamış, sadece puan.'}
                  </Small>
                  <Small style={{ marginTop: 4 }}>
                    Fiyat {r.price} · Ders {r.study} · Porsiyon {r.portion} · Ortam {r.vibe}
                  </Small>
                </View>
              </Row>
            </Box>
          ))
        )}
      </View>
    </View>
  );

  return (
    <StudentPage hasTabBar>
      <View style={{ flexDirection: isWide ? 'row' : 'column', gap: 28, alignItems: 'flex-start' }}>
        <View style={{ width: isWide ? 320 : '100%' }}>{left}</View>
        <View style={column(isWide, 1)}>{right}</View>
      </View>
    </StudentPage>
  );
}

/** Misafirin profil sekmesi: cihazdaki karakter ve favoriler + kayıt çağrısı. */
function GuestProfile({ avatar, favVenues }: { avatar: AvatarConfig | null; favVenues: VenueListItem[] }) {
  const router = useRouter();
  const { isWide } = useLayout();
  return (
    <View style={{ flexDirection: isWide ? 'row' : 'column', gap: 28, alignItems: 'flex-start' }}>
      <View style={{ width: isWide ? 320 : '100%', gap: 18 }}>
        <Box>
          <View style={{ alignItems: isWide ? 'center' : 'flex-start', gap: 10 }}>
            <Avatar config={avatar} size={isWide ? 110 : 78} framed />
            <H2>Misafir</H2>
            <Badge text="GİRİŞ YAPILMADI" bg={colors.blueSoft} />
          </View>
          <Button
            small
            variant="secondary"
            title={avatar ? 'Karakterimi düzenle' : 'Karakter oluştur'}
            onPress={() => router.push('/avatar')}
            style={{ marginTop: 12, alignSelf: isWide ? 'stretch' : 'flex-start' }}
          />
          <Small style={{ marginTop: 10 }}>
            🔒 Karakterin ve favorilerin sadece bu cihazda saklanır, sunucuya gönderilmez.
          </Small>
        </Box>

        <Box bg={colors.orangeSoft}>
          <H3 style={{ marginBottom: 4 }}>Öğrenci misin?</H3>
          <P style={{ fontSize: 14, marginBottom: 10 }}>
            Okul e-postanla kayıt ol; kampanya kodu al, mekanlara puan ver. Favorilerin ve karakterin hesabına taşınır.
          </P>
          <Row style={{ gap: 10, flexWrap: 'wrap' }}>
            <Button small variant="accent" title="KAYIT OL" onPress={() => router.push('/kayit')} />
            <Button small variant="secondary" title="Giriş yap" onPress={() => router.push('/giris?sonra=%2Fprofil')} />
          </Row>
        </Box>

        <Box bg={colors.paper}>
          <Pressable onPress={() => router.push('/kvkk')}>
            <P style={{ color: colors.blue, fontWeight: '700' }}>KVKK Aydınlatma Metni</P>
          </Pressable>
        </Box>
      </View>

      <View style={column(isWide, 1)}>
        <H2 style={{ marginBottom: 10 }}>Favorilerim ({favVenues.length})</H2>
        {favVenues.length === 0 ? (
          <Small>Mekan kartlarındaki ♡ ile favori ekleyebilirsin.</Small>
        ) : (
          favVenues.map((v) => (
            <Box key={v.id} onPress={() => router.push(`/mekan/${v.id}`)} style={{ marginBottom: 10 }} bg={colors.paper}>
              <Row style={{ gap: 10 }}>
                <ScoreTile value={v.stats.avg_overall} size={40} />
                <View style={{ flex: 1 }}>
                  <H3 style={{ fontSize: 15 }} numberOfLines={1}>
                    {v.name}
                  </H3>
                  <Small>{v.district}</Small>
                </View>
                <Small style={{ color: colors.red, fontSize: 18 }}>♥</Small>
              </Row>
            </Box>
          ))
        )}
      </View>
    </View>
  );
}

/** Mekan sahibinin profil sekmesi: hesabı ve panele geçiş. */
function OwnerProfile({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  return (
    <View style={{ gap: 18, maxWidth: 520 }}>
      <Box>
        <H2>{name}</H2>
        <Small numberOfLines={1}>{email}</Small>
        <View style={{ marginTop: 8 }}>
          <Badge text="MEKAN HESABI" bg={colors.greenSoft} />
        </View>
        <Button title="MEKAN PANELİ" onPress={() => router.push('/panel')} style={{ marginTop: 14 }} />
      </Box>
      <Box bg={colors.paper}>
        <H3 style={{ marginBottom: 6 }}>Hesap</H3>
        <Pressable onPress={() => router.push('/kvkk')}>
          <P style={{ color: colors.blue, fontWeight: '700' }}>KVKK Aydınlatma Metni</P>
        </Pressable>
        <Small style={{ marginTop: 4 }}>
          Mekan hesabını kapatmak ya da mekan bilgilerini değiştirmek için Uğrak ekibiyle iletişime geç.
        </Small>
        <Button
          small
          variant="danger"
          title="Çıkış yap"
          onPress={async () => {
            await api.signOut();
            router.replace('/kesfet');
          }}
          style={{ marginTop: 12, alignSelf: 'flex-start' }}
        />
      </Box>
    </View>
  );
}
