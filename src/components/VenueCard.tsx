import React from 'react';
import { Pressable, View } from 'react-native';
import type { VenueListItem } from '@/lib/types';
import { formatDistance } from '@/lib/universities';
import { CATEGORY_LABEL, CRITERIA, colors } from '@/theme';
import { Badge, Box, H3, Row, ScoreBar, ScoreTile, Small } from './ui';

export function priceText(level: number) {
  return '₺'.repeat(level);
}

export function VenueCard({
  v,
  distance,
  favorite,
  onPress,
  onToggleFavorite,
}: {
  v: VenueListItem;
  distance: number | null;
  favorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  const statKey = (k: string) => (v.stats as any)[`avg_${k}`] as number | null;
  return (
    <Box onPress={onPress} style={{ marginBottom: 14 }}>
      <Row style={{ alignItems: 'flex-start', gap: 12 }}>
        <ScoreTile value={v.stats.avg_overall} />
        <View style={{ flex: 1 }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <H3 style={{ flex: 1, marginRight: 8 }} numberOfLines={1}>
              {v.name}
            </H3>
            <Pressable
              onPress={onToggleFavorite}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
            >
              <Small style={{ fontSize: 20, color: favorite ? colors.red : colors.muted, lineHeight: 22 }}>
                {favorite ? '♥' : '♡'}
              </Small>
            </Pressable>
          </Row>
          <Small numberOfLines={1}>
            {CATEGORY_LABEL[v.category] ?? v.category} · {v.district} · {priceText(v.price_level)}
            {distance != null ? ` · ${formatDistance(distance)}` : ''}
          </Small>
          <Small style={{ marginTop: 2 }}>
            {v.stats.review_count > 0 ? `${v.stats.review_count} öğrenci yorumu` : 'Henüz yorum yok — ilk sen ol'}
          </Small>
        </View>
      </Row>
      <View style={{ marginTop: 10 }}>
        {CRITERIA.map((c) => (
          <ScoreBar key={c.key} compact label={c.label} value={statKey(c.key)} />
        ))}
      </View>
      {v.campaigns.length > 0 ? (
        <View style={{ marginTop: 8 }}>
          <Badge bg={colors.orange} text={`KAMPANYA · ${v.campaigns[0].discount_text}`} />
        </View>
      ) : null}
    </Box>
  );
}
