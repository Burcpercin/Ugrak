import React from 'react';
import { Text, View } from 'react-native';
import { useLayout } from '@/lib/useLayout';
import { UNIVERSITIES } from '@/lib/universities';
import { isDemo } from '@/lib/api';
import { colors, fonts } from '@/theme';
import { Avatar } from './Avatar';
import { Logo } from './Brand';
import { Badge, Screen } from './ui';

const FEATURES = [
  ['Sadece öğrenciler', 'Kayıt yalnızca okulun verdiği .edu.tr adresiyle. Her yorum doğrulanmış bir öğrenciden.'],
  ['Öğrenciye göre puan', 'Fiyat, ders çalışmaya uygunluk, porsiyon ve ortam ayrı ayrı puanlanır.'],
  ['Öğrenci kampanyaları', 'Mekanlardan tek kullanımlık, 10 dakika geçerli indirim kodları.'],
];

/**
 * Giriş / kayıt / doğrulama sayfalarının düzeni.
 * Geniş ekranda solda tanıtım paneli, sağda form; dar ekranda sadece form.
 */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { isWide } = useLayout();
  if (!isWide) return <Screen>{children}</Screen>;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
      <View
        style={{
          width: '44%',
          maxWidth: 640,
          backgroundColor: colors.blue,
          borderRightWidth: 3,
          borderColor: colors.ink,
          paddingHorizontal: 48,
          paddingVertical: 40,
          justifyContent: 'space-between',
        }}
      >
        <View style={{ alignSelf: 'flex-start', backgroundColor: colors.paper, borderWidth: 3, borderColor: colors.ink, paddingHorizontal: 12, paddingVertical: 4 }}>
          <Logo size={30} />
        </View>

        <View style={{ gap: 26 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14 }}>
            <Avatar size={64} config={{ skin: 0, hairStyle: 'uzun', hairColor: 1, shirt: 1, glasses: false }} />
            <Avatar size={84} config={{ skin: 2, hairStyle: 'kisa', hairColor: 0, shirt: 5, glasses: true }} />
            <Avatar size={64} config={{ skin: 1, hairStyle: 'bere', hairColor: 2, shirt: 2, glasses: false }} />
          </View>
          <Text style={{ fontFamily: fonts.pixel, fontSize: 36, lineHeight: 42, color: '#fff' }}>
            Kampüsün etrafında nereye gidilir, öğrenciler söylesin.
          </Text>
          <View style={{ gap: 14 }}>
            {FEATURES.map(([t, d]) => (
              <View key={t} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={{ width: 14, height: 14, backgroundColor: colors.orange, borderWidth: 2, borderColor: colors.ink, marginTop: 4 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.pixel, fontSize: 17, color: '#fff' }}>{t}</Text>
                  <Text style={{ fontSize: 14.5, lineHeight: 20, color: '#E3ECFF' }}>{d}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 13, color: '#E3ECFF' }}>İstanbul · {UNIVERSITIES.length} üniversite</Text>
          {isDemo ? <Badge text="DEMO MODU" /> : null}
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {/* flexGrow + justifyContent: form ekranın dikey ortasında durur; uzun formlarda (kayıt) kaydırma yine çalışır */}
        <Screen maxWidth={500} contentStyle={{ flexGrow: 1, justifyContent: 'center', paddingTop: 40, paddingBottom: 40 }}>
          {children}
        </Screen>
      </View>
    </View>
  );
}
