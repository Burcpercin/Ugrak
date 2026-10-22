import React from 'react';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts } from '@/theme';
import { Logo } from './Brand';
import { Badge, Box, H3, P, Row, Small } from './ui';

export type NavItem = { key: string; label: string };

/** Mekan ve admin panellerinin ortak iskeleti (masaüstü öncelikli, mobilde de çalışır). */
export function PanelShell({
  title,
  roleLabel,
  nav,
  active,
  onNav,
  children,
}: {
  title: string;
  roleLabel: string;
  nav: NavItem[];
  active: string;
  onNav: (k: string) => void;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 860;

  const navList = nav.map((n) => {
    const on = n.key === active;
    return (
      <Pressable
        key={n.key}
        onPress={() => onNav(n.key)}
        style={{
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderWidth: 3,
          borderColor: on ? colors.ink : 'transparent',
          backgroundColor: on ? colors.orange : 'transparent',
          marginBottom: wide ? 6 : 0,
          marginRight: wide ? 0 : 8,
        }}
      >
        <Text style={{ fontFamily: fonts.pixel, fontSize: 15, color: on ? colors.ink : '#fff' }}>{n.label}</Text>
      </Pressable>
    );
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Taslak şeridi */}
      <View style={{ backgroundColor: colors.yellow, borderBottomWidth: 3, borderColor: colors.ink, paddingVertical: 6, paddingHorizontal: 16 }}>
        <Text style={{ fontFamily: fonts.pixel, fontSize: 13, color: colors.ink, textAlign: 'center' }}>
          TASLAK EKRAN · ÖRNEK (MOCK) VERİ · Sunumda fikri göstermek içindir, veritabanına bağlı değildir
        </Text>
      </View>

      <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column' }}>
        <View
          style={{
            backgroundColor: colors.ink,
            width: wide ? 230 : undefined,
            padding: 16,
          }}
        >
          <Row style={{ justifyContent: 'space-between', marginBottom: wide ? 18 : 10 }}>
            <View>
              <View style={{ backgroundColor: colors.bg, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' }}>
                <Logo size={22} />
              </View>
              <Text style={{ fontFamily: fonts.pixel, color: colors.orange, marginTop: 6, fontSize: 14 }}>{roleLabel}</Text>
            </View>
            {!wide ? (
              <Pressable onPress={() => router.replace('/giris')}>
                <Small style={{ color: '#fff' }}>Çıkış →</Small>
              </Pressable>
            ) : null}
          </Row>
          {wide ? (
            <View>{navList}</View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {navList}
            </ScrollView>
          )}
          {wide ? (
            <Pressable onPress={() => router.replace('/giris')} style={{ marginTop: 24 }}>
              <Small style={{ color: '#bbb' }}>← Uygulamaya dön</Small>
            </Pressable>
          ) : null}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: wide ? 28 : 16, paddingBottom: 60 }}>
          <View style={{ maxWidth: 980, width: '100%' }}>
            <Text style={{ fontFamily: fonts.pixel, fontSize: wide ? 30 : 24, color: colors.ink, marginBottom: 16 }}>
              {title}
            </Text>
            {children}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

export function Kpi({ label, value, note, bg = colors.card }: { label: string; value: string; note?: string; bg?: string }) {
  return (
    <Box bg={bg} style={{ flexGrow: 1, flexBasis: 180, marginBottom: 12 }}>
      <Small style={{ fontFamily: fonts.pixel, color: colors.ink }}>{label}</Small>
      <Text style={{ fontWeight: '900', fontSize: 32, color: colors.ink, marginTop: 4 }}>{value}</Text>
      {note ? <Small>{note}</Small> : null}
    </Box>
  );
}

/** Basit tablo: başlık satırı + satırlar. Dar ekranda yatay kayar. */
export function Table({
  columns,
  rows,
}: {
  columns: { key: string; label: string; width: number }[];
  rows: Record<string, React.ReactNode>[];
}) {
  const total = columns.reduce((a, c) => a + c.width, 0);
  return (
    <Box padded={false}>
      <ScrollView horizontal>
        <View style={{ minWidth: total }}>
          <Row style={{ backgroundColor: colors.ink, paddingVertical: 8 }}>
            {columns.map((c) => (
              <Text key={c.key} style={{ width: c.width, paddingHorizontal: 10, color: '#fff', fontFamily: fonts.pixel, fontSize: 13 }}>
                {c.label}
              </Text>
            ))}
          </Row>
          {rows.map((r, i) => (
            <Row
              key={i}
              style={{
                paddingVertical: 9,
                backgroundColor: i % 2 ? colors.paper : colors.card,
                borderTopWidth: i ? 1 : 0,
                borderColor: '#d8d0c2',
              }}
            >
              {columns.map((c) => (
                <View key={c.key} style={{ width: c.width, paddingHorizontal: 10 }}>
                  {typeof r[c.key] === 'string' || typeof r[c.key] === 'number' ? (
                    <P style={{ fontSize: 14 }}>{r[c.key]}</P>
                  ) : (
                    r[c.key]
                  )}
                </View>
              ))}
            </Row>
          ))}
        </View>
      </ScrollView>
    </Box>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: 10, marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
      <H3>{children}</H3>
      {right}
    </Row>
  );
}

export function V2Note({ text }: { text: string }) {
  return (
    <View style={{ marginTop: 6, marginBottom: 12 }}>
      <Badge text={`V2 · ${text}`} bg={colors.blueSoft} />
    </View>
  );
}
