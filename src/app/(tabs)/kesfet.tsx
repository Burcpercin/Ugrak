import React, { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { column, useLayout } from '@/lib/useLayout';
import { useVenues } from '@/lib/useVenues';
import { useLocation } from '@/lib/location';
import { distanceMeters } from '@/lib/universities';
import { LocationBar } from '@/components/LocationBar';
import { AccessStrip } from '@/components/StudentOnly';
import { StudentPage } from '@/components/StudentPage';
import { VenueCard } from '@/components/VenueCard';
import { Banner, Box, Button, Chip, H1, H2, H3, Loading, P, Row, Small } from '@/components/ui';
import { CATEGORY_LABEL, colors, fonts } from '@/theme';

type Sort = 'puan' | 'yakin' | 'ucuz';
const SORTS: [Sort, string][] = [
  ['yakin', 'Yakınımda'],
  ['puan', 'Puan'],
  ['ucuz', 'Uygun fiyat'],
];
// Mesafe sınırı (metre); null = sınır yok
const RADII: [number | null, string][] = [
  [null, 'Hepsi'],
  [1000, '1 km'],
  [3000, '3 km'],
  [10000, '10 km'],
];

export default function Kesfet() {
  const router = useRouter();
  const { hosgeldin } = useLocalSearchParams<{ hosgeldin?: string }>();
  const { profile } = useAuth();
  const { origin } = useLocation();
  const { isWide, gridCols } = useLayout();
  const { venues, favorites, error, toggleFavorite } = useVenues();

  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [radius, setRadius] = useState<number | null>(null);
  const [sortChoice, setSort] = useState<Sort | null>(null);
  const [welcome, setWelcome] = useState(hosgeldin === '1');
  // Konum varsa varsayılan sıralama yakınlık, yoksa puan.
  const sort: Sort = sortChoice ?? (origin ? 'yakin' : 'puan');

  const list = useMemo(() => {
    if (!venues) return [];
    const needle = q.trim().toLocaleLowerCase('tr');
    const items = venues
      .filter((v) => !cat || v.category === cat)
      .filter(
        (v) =>
          !needle ||
          v.name.toLocaleLowerCase('tr').includes(needle) ||
          v.district.toLocaleLowerCase('tr').includes(needle),
      )
      .map((v) => ({ v, d: origin ? distanceMeters(origin.lat, origin.lng, v.lat, v.lng) : null }))
      .filter((x) => radius == null || x.d == null || x.d <= radius);
    items.sort((a, b) => {
      if (sort === 'yakin' && a.d != null && b.d != null) return a.d - b.d;
      if (sort === 'ucuz') return a.v.price_level - b.v.price_level || (b.v.stats.avg_price ?? 0) - (a.v.stats.avg_price ?? 0);
      return (b.v.stats.avg_overall ?? -1) - (a.v.stats.avg_overall ?? -1);
    });
    return items;
  }, [venues, cat, q, sort, origin, radius]);

  const featured = list.find((x) => x.v.campaigns.length > 0);
  const categories = Object.keys(CATEGORY_LABEL).filter((c) => (venues ?? []).some((v) => v.category === c));
  const filtersActive = radius != null || !!cat || !!q;
  const clearFilters = () => {
    setRadius(null);
    setCat(null);
    setQ('');
  };

  // ----- Filtre paneli (geniş ekranda solda, dar ekranda üstte) -----
  const filters = (
    <View style={{ gap: 18 }}>
      <View>
        <Label>Ara</Label>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Mekan ya da semt…"
          placeholderTextColor="#9C9488"
          style={{
            borderWidth: 3,
            borderColor: colors.ink,
            backgroundColor: colors.card,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 15,
            color: colors.ink,
          }}
        />
      </View>

      {origin ? (
        <View>
          <Label>Mesafe</Label>
          <Row style={{ flexWrap: 'wrap' }}>
            {RADII.map(([r, l]) => (
              <Chip key={l} label={l} active={radius === r} onPress={() => setRadius(r)} />
            ))}
          </Row>
        </View>
      ) : null}

      <View>
        <Label>Kategori</Label>
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip label="Tümü" active={!cat} onPress={() => setCat(null)} />
          {categories.map((c) => (
            <Chip key={c} label={CATEGORY_LABEL[c]} active={cat === c} onPress={() => setCat(cat === c ? null : c)} />
          ))}
        </Row>
      </View>

      <View>
        <Label>Sırala</Label>
        <Row style={{ flexWrap: 'wrap' }}>
          {SORTS.filter(([k]) => k !== 'yakin' || origin).map(([k, l]) => (
            <Chip key={k} label={l} active={sort === k} onPress={() => setSort(k)} />
          ))}
        </Row>
      </View>

      {filtersActive ? (
        <Pressable onPress={clearFilters}>
          <Small style={{ color: colors.blue, fontWeight: '700' }}>Filtreleri temizle</Small>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <StudentPage hasTabBar>
      {/* Başlık */}
      <View style={{ marginBottom: 18 }}>
        <H1 style={{ fontSize: isWide ? 34 : 26 }}>
          {origin ? 'Yakınındaki uğrak yerleri' : 'İstanbul’daki uğrak yerleri'}
        </H1>
        <P style={{ color: colors.muted }}>
          Doğrulanmış öğrencilerin fiyat, ders çalışma, porsiyon ve ortam puanları.
        </P>
      </View>

      <AccessStrip />
      <LocationBar />

      {welcome ? (
        <Banner kind="ok" title={`Hoş geldin, ${profile?.display_name}!`}>
          <P style={{ fontSize: 14 }}>
            Öğrenci hesabın doğrulandı. Artık puan verebilir, kampanya kodu alabilirsin.
          </P>
          <Pressable onPress={() => setWelcome(false)}>
            <Small style={{ marginTop: 6, color: colors.blue, fontWeight: '700' }}>Kapat</Small>
          </Pressable>
        </Banner>
      ) : null}

      <View style={{ flexDirection: isWide ? 'row' : 'column', gap: isWide ? 28 : 18, alignItems: 'flex-start' }}>
        {/* Sol: filtreler */}
        <View style={{ width: isWide ? 280 : '100%' }}>
          <Box bg={colors.paper}>{filters}</Box>
        </View>

        {/* Sağ: sonuçlar */}
        <View style={column(isWide, 1)}>
          {error ? <Banner kind="error" text={error} /> : null}
          {!venues ? <Loading /> : null}

          {featured ? (
            <Box bg={colors.orange} style={{ marginBottom: 20 }} onPress={() => router.push(`/mekan/${featured.v.id}`)}>
              <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <View style={{ flexShrink: 1 }}>
                  <Small style={{ fontFamily: fonts.pixel, color: colors.ink, letterSpacing: 1 }}>★ ÖNE ÇIKAN KAMPANYA</Small>
                  <H2 style={{ marginTop: 4 }}>{featured.v.campaigns[0].discount_text}</H2>
                  <P style={{ fontSize: 14 }}>
                    {featured.v.campaigns[0].title} · {featured.v.name}
                  </P>
                </View>
                <View style={{ borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ fontFamily: fonts.pixel, fontSize: 15, color: colors.ink }}>Kodu al →</Text>
                </View>
              </Row>
            </Box>
          ) : null}

          {venues && list.length === 0 ? (
            <Box bg={colors.paper}>
              <H3>Burada henüz mekan yok</H3>
              <P style={{ fontSize: 14, marginVertical: 6 }}>Mesafeyi büyüt ya da filtreleri temizle.</P>
              <Button small variant="secondary" title="Filtreleri temizle" style={{ alignSelf: 'flex-start' }} onPress={clearFilters} />
            </Box>
          ) : null}

          {list.length > 0 ? (
            <Small style={{ marginBottom: 10 }}>
              {list.length} mekan{origin ? ` · mesafeler: ${origin.label}` : ''}
            </Small>
          ) : null}

          {/* Kart ızgarası */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 }}>
            {list.map(({ v, d }) => (
              <View key={v.id} style={{ width: `${100 / Math.min(gridCols, 2)}%` as any, paddingHorizontal: 8 }}>
                <VenueCard
                  v={v}
                  distance={d}
                  favorite={favorites.includes(v.id)}
                  onPress={() => router.push(`/mekan/${v.id}`)}
                  onToggleFavorite={() => toggleFavorite(v.id)}
                />
              </View>
            ))}
          </View>
        </View>
      </View>
    </StudentPage>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontFamily: fonts.pixel, fontSize: 13, color: colors.muted, letterSpacing: 1, marginBottom: 8 }}>
      {String(children).toLocaleUpperCase('tr')}
    </Text>
  );
}
