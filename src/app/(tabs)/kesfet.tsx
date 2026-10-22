import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useVenues } from '@/lib/useVenues';
import { UNIVERSITIES, distanceMeters, universityById } from '@/lib/universities';
import { Avatar } from '@/components/Avatar';
import { Logo } from '@/components/Brand';
import { VenueCard } from '@/components/VenueCard';
import { Banner, Box, Button, Chip, H2, H3, Loading, P, Row, Screen, Small } from '@/components/ui';
import { CATEGORY_LABEL, colors, fonts } from '@/theme';

type Sort = 'puan' | 'yakin' | 'ucuz';

export default function Kesfet() {
  const router = useRouter();
  const { hosgeldin } = useLocalSearchParams<{ hosgeldin?: string }>();
  const { profile } = useAuth();
  const { venues, favorites, error, toggleFavorite } = useVenues();
  const myUni = universityById(profile?.university_id);

  const [campusId, setCampusId] = useState<number | 'all'>(profile?.university_id ?? 'all');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('puan');
  const [welcome, setWelcome] = useState(hosgeldin === '1');

  const campus = campusId === 'all' ? myUni : universityById(campusId);

  // Mekanı olan kampüsler (seçici için)
  const campusesWithVenues = useMemo(() => {
    const ids = new Set((venues ?? []).map((v) => v.university_id));
    return UNIVERSITIES.filter((u) => ids.has(u.id) && u.id !== profile?.university_id);
  }, [venues, profile?.university_id]);

  const list = useMemo(() => {
    if (!venues) return [];
    const needle = q.trim().toLocaleLowerCase('tr');
    const items = venues
      .filter((v) => campusId === 'all' || v.university_id === campusId)
      .filter((v) => !cat || v.category === cat)
      .filter(
        (v) =>
          !needle ||
          v.name.toLocaleLowerCase('tr').includes(needle) ||
          v.district.toLocaleLowerCase('tr').includes(needle),
      )
      .map((v) => ({ v, d: campus ? distanceMeters(campus.lat, campus.lng, v.lat, v.lng) : null }));
    items.sort((a, b) => {
      if (sort === 'yakin') return (a.d ?? 0) - (b.d ?? 0);
      if (sort === 'ucuz') return a.v.price_level - b.v.price_level || (b.v.stats.avg_price ?? 0) - (a.v.stats.avg_price ?? 0);
      return (b.v.stats.avg_overall ?? -1) - (a.v.stats.avg_overall ?? -1);
    });
    return items;
  }, [venues, campusId, cat, q, sort, campus]);

  const featured = list.find((x) => x.v.campaigns.length > 0);
  const categories = Object.keys(CATEGORY_LABEL).filter((c) => (venues ?? []).some((v) => v.category === c));

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Logo size={28} />
        <Pressable onPress={() => router.push('/profil')} accessibilityLabel="Profil">
          <Avatar config={profile?.avatar} size={34} framed bg={colors.orangeSoft} />
        </Pressable>
      </Row>

      {welcome ? (
        <Banner kind="ok" title={`Hoş geldin, ${profile?.display_name}!`}>
          <P style={{ fontSize: 14 }}>
            Öğrenci hesabın doğrulandı. {myUni ? `${myUni.short_name} çevresindeki mekanlar listelendi.` : ''} Puan ver,
            kampanyalardan yararlan.
          </P>
          <Pressable onPress={() => setWelcome(false)}>
            <Small style={{ marginTop: 6, color: colors.blue, fontWeight: '700' }}>Kapat</Small>
          </Pressable>
        </Banner>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
        {myUni ? (
          <Chip label={`📍 ${myUni.short_name}`} active={campusId === myUni.id} onPress={() => setCampusId(myUni.id)} />
        ) : null}
        <Chip label="Tüm İstanbul" active={campusId === 'all'} onPress={() => setCampusId('all')} />
        {campusesWithVenues.map((u) => (
          <Chip key={u.id} label={u.short_name} active={campusId === u.id} onPress={() => setCampusId(u.id)} />
        ))}
      </ScrollView>

      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Mekan ya da semt ara…"
        placeholderTextColor="#9C9488"
        style={{
          borderWidth: 3,
          borderColor: colors.ink,
          backgroundColor: colors.card,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 15,
          marginBottom: 10,
          color: colors.ink,
        }}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Chip label="Tümü" active={!cat} onPress={() => setCat(null)} />
        {categories.map((c) => (
          <Chip key={c} label={CATEGORY_LABEL[c]} active={cat === c} onPress={() => setCat(cat === c ? null : c)} />
        ))}
      </ScrollView>

      <Row style={{ marginTop: 2, marginBottom: 12, gap: 8 }}>
        <Small style={{ fontFamily: fonts.pixel, color: colors.ink }}>Sırala:</Small>
        {(
          [
            ['puan', 'Puan'],
            ['yakin', 'Yakınlık'],
            ['ucuz', 'Uygun fiyat'],
          ] as [Sort, string][]
        ).map(([k, l]) => (
          <Pressable key={k} onPress={() => setSort(k)}>
            <Small
              style={{
                color: sort === k ? colors.blue : colors.muted,
                fontWeight: sort === k ? '700' : '400',
                textDecorationLine: sort === k ? 'underline' : 'none',
              }}
            >
              {l}
            </Small>
          </Pressable>
        ))}
      </Row>

      {error ? <Banner kind="error" text={error} /> : null}
      {!venues ? <Loading /> : null}

      {featured ? (
        <Box bg={colors.orange} style={{ marginBottom: 18 }} onPress={() => router.push(`/mekan/${featured.v.id}`)}>
          <Small style={{ fontFamily: fonts.pixel, color: colors.ink, letterSpacing: 1 }}>★ ÖNE ÇIKAN KAMPANYA</Small>
          <H2 style={{ marginTop: 4 }}>{featured.v.campaigns[0].discount_text}</H2>
          <P style={{ fontSize: 14 }}>
            {featured.v.campaigns[0].title} · {featured.v.name}
          </P>
          <Small style={{ color: colors.ink, marginTop: 6 }}>Kodu almak için dokun →</Small>
        </Box>
      ) : null}

      {venues && list.length === 0 ? (
        <Box bg={colors.paper}>
          <H3>Burada henüz mekan yok</H3>
          <P style={{ fontSize: 14, marginVertical: 6 }}>Filtreleri temizle ya da tüm İstanbul’a bak.</P>
          <Button
            small
            variant="secondary"
            title="Tüm İstanbul"
            onPress={() => {
              setCampusId('all');
              setCat(null);
              setQ('');
            }}
          />
        </Box>
      ) : null}

      {list.length > 0 ? (
        <Small style={{ marginBottom: 8 }}>
          {list.length} mekan{campus ? ` · mesafeler ${campus.short_name} kampüsüne göre` : ''}
        </Small>
      ) : null}

      <View>
        {list.map(({ v, d }) => (
          <VenueCard
            key={v.id}
            v={v}
            distance={d}
            favorite={favorites.includes(v.id)}
            onPress={() => router.push(`/mekan/${v.id}`)}
            onToggleFavorite={() => toggleFavorite(v.id)}
          />
        ))}
      </View>
    </Screen>
  );
}
