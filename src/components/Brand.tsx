import React from 'react';
import { Text, View } from 'react-native';
import { colors, fonts } from '@/theme';
import { Avatar } from './Avatar';
import { Badge, Row } from './ui';
import { isDemo } from '@/lib/api';

export function Logo({ size = 44 }: { size?: number }) {
  return (
    <Text style={{ fontFamily: fonts.pixel, fontSize: size, color: colors.ink, letterSpacing: 2 }}>
      UĞR<Text style={{ color: colors.orange }}>A</Text>K
    </Text>
  );
}

export function Hero() {
  return (
    <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 20 }}>
      <Row style={{ gap: 10, marginBottom: 12, alignItems: 'flex-end' }}>
        <Avatar size={40} config={{ skin: 0, hairStyle: 'uzun', hairColor: 1, shirt: 1, glasses: false }} />
        <Avatar size={52} config={{ skin: 2, hairStyle: 'kisa', hairColor: 0, shirt: 0, glasses: true }} />
        <Avatar size={40} config={{ skin: 1, hairStyle: 'bere', hairColor: 2, shirt: 2, glasses: false }} />
      </Row>
      <Logo />
      <Text style={{ fontFamily: fonts.pixelRegular, fontSize: 16, color: colors.muted, marginTop: 4, textAlign: 'center' }}>
        İstanbul’da öğrencinin uğrak yerleri
      </Text>
      {isDemo ? (
        <View style={{ marginTop: 10 }}>
          <Badge text="DEMO MODU" />
        </View>
      ) : null}
    </View>
  );
}
