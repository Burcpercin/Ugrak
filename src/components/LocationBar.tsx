import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { campusLabel, useLocation } from '@/lib/location';
import { universityById } from '@/lib/universities';
import { colors, fonts } from '@/theme';
import { Banner, Box, Button, H2, H3, P, Row, Small } from './ui';

const PRIVACY = 'Konumun sadece bu cihazda mesafe hesaplamak için kullanılır; sunucuya gönderilmez, kaydedilmez.';

/**
 * Keşfet'in üstündeki "nereye göre?" çubuğu.
 * Konum seçilmemişse izin kartı, seçilmişse kısa bir satır + "Değiştir".
 */
export function LocationBar() {
  const { origin, status, locateMe } = useLocation();
  const [picker, setPicker] = useState(false);

  const body = !origin ? (
    <Box bg={colors.blueSoft} style={{ marginBottom: 18 }}>
      <H3 style={{ marginBottom: 4 }}>📍 Yakınındakileri görelim mi?</H3>
      <P style={{ fontSize: 14, marginBottom: 8 }}>
        Mekanları sana olan uzaklığa göre sıralamak için konumunu kullanabiliriz. İstemezsen bir kampüs seç.
      </P>
      {status === 'denied' ? (
        <Banner
          kind="warn"
          text="Konum izni verilmedi. Telefon ayarlarından izin verebilir ya da kampüs seçebilirsin."
        />
      ) : null}
      {status === 'error' ? <Banner kind="warn" text="Konum alınamadı. Konum servisini açıp tekrar dene ya da kampüs seç." /> : null}
      <Row style={{ gap: 10, flexWrap: 'wrap' }}>
        <Button small title="KONUMUMU KULLAN" loading={status === 'locating'} onPress={() => void locateMe()} />
        <Button small variant="secondary" title="Kampüs seç" onPress={() => setPicker(true)} />
      </Row>
      <Small style={{ marginTop: 10 }}>🔒 {PRIVACY}</Small>
    </Box>
  ) : (
    <Row
      style={{
        marginBottom: 16,
        gap: 10,
        justifyContent: 'space-between',
        borderWidth: 3,
        borderColor: colors.ink,
        backgroundColor: colors.paper,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Small style={{ fontFamily: fonts.pixel, color: colors.muted, letterSpacing: 1 }}>MESAFELER</Small>
        <Text numberOfLines={1} style={{ fontFamily: fonts.pixel, fontSize: 15, color: colors.ink }}>
          📍 {origin.label}
          {origin.source === 'default' ? ' (okulun)' : ''}
        </Text>
      </View>
      <Pressable onPress={() => setPicker(true)} accessibilityRole="button" hitSlop={8}>
        <Small style={{ color: colors.blue, fontWeight: '700' }}>Değiştir</Small>
      </Pressable>
    </Row>
  );

  return (
    <>
      {body}
      <CampusPicker visible={picker} onClose={() => setPicker(false)} />
    </>
  );
}

function CampusPicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { campuses, origin, status, locateMe, chooseCampus, clearChoice } = useLocation();
  const [q, setQ] = useState('');

  const groups = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase('tr');
    const map = new Map<number, typeof campuses>();
    for (const c of campuses) {
      const u = universityById(c.university_id);
      const hay = `${u?.name ?? ''} ${u?.short_name ?? ''} ${c.name} ${c.district ?? ''}`.toLocaleLowerCase('tr');
      if (needle && !hay.includes(needle)) continue;
      map.set(c.university_id, [...(map.get(c.university_id) ?? []), c]);
    }
    return [...map.entries()];
  }, [campuses, q]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(27,27,27,0.55)', justifyContent: 'center', padding: 16 }}
      >
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 460, maxHeight: '90%', alignSelf: 'center' }}>
          <Box bg={colors.paper} style={{ maxHeight: '100%' }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
              <H2 style={{ fontSize: 20 }}>Nereye göre?</H2>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Kapat" hitSlop={10}>
                <Text style={{ fontFamily: fonts.pixel, fontSize: 18, color: colors.ink }}>✕</Text>
              </Pressable>
            </Row>

            <Button
              small
              title={origin?.source === 'gps' ? '✓ KONUMUM KULLANILIYOR' : '📍 KONUMUMU KULLAN'}
              loading={status === 'locating'}
              onPress={async () => {
                if (await locateMe()) onClose();
              }}
            />
            {status === 'denied' ? (
              <Small style={{ color: colors.red, marginTop: 6 }}>
                Konum izni verilmedi. Telefon ayarlarından izin verebilir ya da aşağıdan kampüs seçebilirsin.
              </Small>
            ) : null}
            {status === 'error' ? (
              <Small style={{ color: colors.red, marginTop: 6 }}>Konum alınamadı; konum servisini açıp tekrar dene.</Small>
            ) : null}
            <Small style={{ marginTop: 6, marginBottom: 12 }}>🔒 {PRIVACY}</Small>

            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Üniversite ya da kampüs ara…"
              placeholderTextColor="#9C9488"
              style={{
                borderWidth: 3,
                borderColor: colors.ink,
                backgroundColor: colors.card,
                paddingHorizontal: 12,
                paddingVertical: 8,
                fontSize: 15,
                color: colors.ink,
                marginBottom: 10,
              }}
            />

            <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
              {groups.length === 0 ? <Small>Sonuç yok.</Small> : null}
              {groups.map(([uid, list]) => (
                <View key={uid} style={{ marginBottom: 10 }}>
                  <Small style={{ fontFamily: fonts.pixel, color: colors.muted, letterSpacing: 1, marginBottom: 4 }}>
                    {(universityById(uid)?.name ?? '').toLocaleUpperCase('tr')}
                  </Small>
                  {list.map((c) => {
                    const on = origin?.source === 'campus' && origin.label === campusLabel(c);
                    return (
                      <Pressable
                        key={c.id}
                        onPress={async () => {
                          await chooseCampus(c);
                          onClose();
                        }}
                        accessibilityRole="button"
                        style={({ hovered }: any) => ({
                          paddingVertical: 8,
                          paddingHorizontal: 10,
                          borderWidth: 2,
                          borderColor: on ? colors.ink : 'transparent',
                          backgroundColor: on ? colors.orangeSoft : hovered ? colors.blueSoft : 'transparent',
                        })}
                      >
                        <Text style={{ fontSize: 15, color: colors.ink, fontWeight: on ? '700' : '400' }}>
                          {c.name}
                          {c.district ? <Text style={{ color: colors.muted }}> · {c.district}</Text> : null}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            {origin && origin.source !== 'default' ? (
              <Pressable
                onPress={async () => {
                  await clearChoice();
                  onClose();
                }}
                style={{ marginTop: 10 }}
              >
                <Small style={{ color: colors.blue, fontWeight: '700' }}>Seçimi kaldır</Small>
              </Pressable>
            ) : null}
          </Box>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
