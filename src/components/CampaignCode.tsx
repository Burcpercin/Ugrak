import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { api, errorMessage } from '@/lib/api';
import type { Campaign, Redemption } from '@/lib/types';
import { colors, fonts } from '@/theme';
import { QRCode } from './QRCode';
import { Banner, Box, Button, H2, Loading, P, Small } from './ui';

export function CampaignCard({
  c,
  venueName,
  onGetCode,
}: {
  c: Campaign;
  venueName?: string;
  onGetCode: () => void;
}) {
  return (
    <Box bg={colors.orangeSoft} style={{ marginBottom: 12 }}>
      <Small style={{ fontFamily: fonts.pixel, color: colors.ink, letterSpacing: 1 }}>KAMPANYA</Small>
      <H2 style={{ fontSize: 20, marginTop: 2 }}>{c.discount_text}</H2>
      <P style={{ fontSize: 14, fontWeight: '700' }}>
        {c.title}
        {venueName ? ` · ${venueName}` : ''}
      </P>
      {c.description ? <P style={{ fontSize: 14 }}>{c.description}</P> : null}
      <Small style={{ marginTop: 4 }}>Son gün: {new Date(c.ends_at).toLocaleDateString('tr-TR')}</Small>
      <Button small variant="accent" title="KODU AL" onPress={onGetCode} style={{ marginTop: 10, alignSelf: 'flex-start' }} />
    </Box>
  );
}

export function CampaignCodeModal({
  campaign,
  venueName,
  onClose,
}: {
  campaign: Campaign | null;
  venueName?: string;
  onClose: () => void;
}) {
  const [red, setRed] = useState<Redemption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setRed(null);
    setError(null);
    if (!campaign) return;
    api
      .createRedemption(campaign.id)
      .then(setRed)
      .catch((e) => setError(errorMessage(e)));
  }, [campaign?.id]);

  useEffect(() => {
    if (!red) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [red?.id]);

  const left = red ? Math.max(0, new Date(red.expires_at).getTime() - now) : 0;
  const mm = String(Math.floor(left / 60000)).padStart(2, '0');
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
  const expired = !!red && left <= 0;

  return (
    <Modal visible={!!campaign} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(27,27,27,0.55)', justifyContent: 'center', padding: 20 }}
      >
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 380, alignSelf: 'center' }}>
          <Box bg={colors.paper}>
            <Small style={{ fontFamily: fonts.pixel, color: colors.ink, letterSpacing: 1 }}>KAMPANYA KODUN</Small>
            <H2 style={{ marginTop: 2 }}>{campaign?.discount_text}</H2>
            <P style={{ fontSize: 14 }}>
              {campaign?.title}
              {venueName ? ` · ${venueName}` : ''}
            </P>

            {error ? <Banner kind="error" text={error} /> : null}
            {!red && !error ? <Loading /> : null}

            {red ? (
              <View style={{ alignItems: 'center', marginTop: 12 }}>
                <View style={{ borderWidth: 3, borderColor: colors.ink, opacity: expired ? 0.2 : 1 }}>
                  <QRCode value={`UGRAK:${red.code}`} size={190} />
                </View>
                <Text
                  selectable
                  style={{ fontFamily: Platform.OS === 'web' ? 'ui-monospace, Menlo, Consolas, monospace' : 'monospace', fontWeight: '800', fontSize: 34, letterSpacing: 6, marginTop: 12, color: colors.ink }}
                >
                  {red.code}
                </Text>
                <View
                  style={{
                    marginTop: 8,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderWidth: 2,
                    borderColor: colors.ink,
                    backgroundColor: expired ? colors.redSoft : left < 60000 ? colors.orangeSoft : colors.greenSoft,
                  }}
                >
                  <Text style={{ fontFamily: fonts.pixel, fontSize: 15, color: colors.ink }}>
                    {expired ? 'SÜRESİ DOLDU' : `${mm}:${ss} geçerli`}
                  </Text>
                </View>
                <Small style={{ textAlign: 'center', marginTop: 10 }}>
                  Kasada bu kodu öğrenci kimlik kartınla birlikte göster. Kod tek kullanımlık ve 10 dakika sonra
                  geçersiz olur; ekran görüntüsünü paylaşmak işe yaramaz.
                </Small>
              </View>
            ) : null}

            <Button title="KAPAT" variant="secondary" onPress={onClose} style={{ marginTop: 14 }} />
          </Box>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
