import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useLocation } from '@/lib/location';
import { useLayout } from '@/lib/useLayout';
import { useVenues } from '@/lib/useVenues';
import type { Campaign } from '@/lib/types';
import { distanceMeters, formatDistance } from '@/lib/universities';
import { AccessStrip } from '@/components/StudentOnly';
import { StudentPage } from '@/components/StudentPage';
import { CampaignCard, CampaignCodeModal } from '@/components/CampaignCode';
import { Banner, Box, H1, Loading, P, Small } from '@/components/ui';
import { colors } from '@/theme';

export default function Kampanyalar() {
  const router = useRouter();
  const { origin } = useLocation();
  const { isWide, gridCols } = useLayout();
  const { venues, error } = useVenues();
  const [open, setOpen] = useState<{ c: Campaign; venueName: string } | null>(null);

  const items = useMemo(() => {
    if (!venues) return [];
    return venues
      .flatMap((v) =>
        v.campaigns.map((c) => ({
          c,
          v,
          d: origin ? distanceMeters(origin.lat, origin.lng, v.lat, v.lng) : 0,
        })),
      )
      .sort((a, b) => a.d - b.d);
  }, [venues, origin]);

  return (
    <StudentPage hasTabBar>
      <View style={{ marginBottom: 18 }}>
        <H1 style={{ fontSize: isWide ? 34 : 26 }}>Kampanyalar</H1>
        <P style={{ color: colors.muted }}>
          Kodlar sadece doğrulanmış öğrencilere verilir. {origin ? `${origin.label} konumuna yakın olanlar önce.` : ''}{' '}
          Kod 10 dakika geçerli ve tek kullanımlık.
        </P>
      </View>

      <AccessStrip />

      {error ? <Banner kind="error" text={error} /> : null}
      {!venues ? <Loading /> : null}
      {venues && items.length === 0 ? (
        <Box bg={colors.paper}>
          <P>Şu an aktif kampanya yok.</P>
        </Box>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -8 }}>
        {items.map(({ c, v, d }) => (
          <View key={c.id} style={{ width: `${100 / gridCols}%` as any, paddingHorizontal: 8, marginBottom: 6 }}>
            <Pressable onPress={() => router.push(`/mekan/${v.id}`)}>
              <Small style={{ marginBottom: 6, color: colors.ink }}>
                {v.name} · {v.district}
                {origin ? ` · ${formatDistance(d)}` : ''} →
              </Small>
            </Pressable>
            <CampaignCard c={c} onGetCode={() => setOpen({ c, venueName: v.name })} />
          </View>
        ))}
      </View>

      <CampaignCodeModal campaign={open?.c ?? null} venueName={open?.venueName} onClose={() => setOpen(null)} />
    </StudentPage>
  );
}
