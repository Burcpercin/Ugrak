import React, { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { useVenues } from '@/lib/useVenues';
import type { Campaign } from '@/lib/types';
import { distanceMeters, formatDistance, universityById } from '@/lib/universities';
import { CampaignCard, CampaignCodeModal } from '@/components/CampaignCode';
import { Banner, Box, H2, Loading, P, Screen, Small } from '@/components/ui';
import { colors } from '@/theme';

export default function Kampanyalar() {
  const router = useRouter();
  const { profile } = useAuth();
  const { venues, error } = useVenues();
  const [open, setOpen] = useState<{ c: Campaign; venueName: string } | null>(null);
  const uni = universityById(profile?.university_id);

  const items = useMemo(() => {
    if (!venues) return [];
    return venues
      .flatMap((v) =>
        v.campaigns.map((c) => ({
          c,
          v,
          d: uni ? distanceMeters(uni.lat, uni.lng, v.lat, v.lng) : 0,
        })),
      )
      .sort((a, b) => a.d - b.d);
  }, [venues, uni]);

  return (
    <Screen>
      <H2>Kampanyalar</H2>
      <Small style={{ marginBottom: 14 }}>
        Sadece doğrulanmış öğrencilere özel. {uni ? `${uni.short_name} kampüsüne yakın olanlar üstte.` : ''}
      </Small>

      {error ? <Banner kind="error" text={error} /> : null}
      {!venues ? <Loading /> : null}
      {venues && items.length === 0 ? (
        <Box bg={colors.paper}>
          <P>Şu an aktif kampanya yok.</P>
        </Box>
      ) : null}

      {items.map(({ c, v, d }) => (
        <React.Fragment key={c.id}>
          <Pressable onPress={() => router.push(`/mekan/${v.id}`)}>
            <Small style={{ marginBottom: 4, color: colors.ink }}>
              {v.name} · {v.district}
              {uni ? ` · ${formatDistance(d)}` : ''} →
            </Small>
          </Pressable>
          <CampaignCard c={c} onGetCode={() => setOpen({ c, venueName: v.name })} />
        </React.Fragment>
      ))}

      <CampaignCodeModal campaign={open?.c ?? null} venueName={open?.venueName} onClose={() => setOpen(null)} />
    </Screen>
  );
}
