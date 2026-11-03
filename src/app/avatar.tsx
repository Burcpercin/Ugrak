import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { AvatarConfig } from '@/lib/types';
import {
  Avatar,
  DEFAULT_AVATAR,
  HAIR_COLORS,
  HAIR_STYLES,
  SHIRTS,
  SKINS,
  randomAvatar,
} from '@/components/Avatar';
import { Banner, Box, Button, Chip, Field, H2, H3, Loading, Row, Screen, Small } from '@/components/ui';
import { colors } from '@/theme';
import { useLayout } from '@/lib/useLayout';

export default function AvatarScreen() {
  const router = useRouter();
  const { ilk } = useLocalSearchParams<{ ilk?: string }>();
  const first = ilk === '1';
  const { session, profile, setProfile, ready, guestAvatar, setGuestAvatar } = useAuth();
  // Misafir de karakter oluşturabilir; karakter sadece bu cihazda saklanır.
  const guest = ready && !session;
  const [cfg, setCfg] = useState<AvatarConfig>(DEFAULT_AVATAR);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isWide } = useLayout();

  useEffect(() => {
    if (profile) {
      if (profile.avatar && Object.keys(profile.avatar).length) setCfg({ ...DEFAULT_AVATAR, ...profile.avatar });
      // İlk kez karakter oluşturan öğrenci misafirken yaptığı karakterle başlar.
      else if (guestAvatar) setCfg({ ...DEFAULT_AVATAR, ...guestAvatar });
      setName(profile.display_name);
    } else if (guest && guestAvatar) {
      setCfg({ ...DEFAULT_AVATAR, ...guestAvatar });
    }
  }, [profile?.id, guest]);

  if (!ready || (session && !profile)) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const set = <K extends keyof AvatarConfig>(k: K, v: AvatarConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  async function save() {
    setError(null);
    setBusy(true);
    try {
      if (guest) {
        await setGuestAvatar(cfg);
        router.replace('/profil');
        return;
      }
      const trimmed = name.trim();
      if (trimmed.length < 1 || trimmed.length > 24) throw new Error('Takma ad 1-24 karakter olmalı.');
      const p = await api.updateProfile({ avatar: cfg, display_name: trimmed });
      setProfile(p);
      router.replace(first ? '/kesfet?hosgeldin=1' : '/profil');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  // Sahne (karakter önizlemesi)
  const stage = (
    <View>
      <Box padded={false} bg="#9ED3F5">
        <View style={{ height: isWide ? 340 : 210, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' }}>
          <View style={{ position: 'absolute', top: 22, left: 28, width: 46, height: 14, backgroundColor: '#fff' }} />
          <View style={{ position: 'absolute', top: 14, left: 40, width: 22, height: 10, backgroundColor: '#fff' }} />
          <View style={{ position: 'absolute', top: 40, right: 36, width: 38, height: 12, backgroundColor: '#fff' }} />
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: isWide ? 48 : 34, backgroundColor: '#6BBF59', borderTopWidth: 3, borderColor: colors.ink }} />
          <View style={{ marginBottom: isWide ? 30 : 20 }}>
            <Avatar config={cfg} size={isWide ? 200 : 128} />
          </View>
        </View>
      </Box>
      <Row style={{ gap: 10, marginTop: 14 }}>
        <Button small variant="accent" title="🎲 Rastgele" onPress={() => setCfg(randomAvatar())} />
        <Button small variant="secondary" title="Sıfırla" onPress={() => setCfg(DEFAULT_AVATAR)} />
      </Row>
    </View>
  );

  // Seçenekler ve kaydet
  const controls = (
    <View>
      <Box>
        {guest ? (
          <Small style={{ marginBottom: 12 }}>
            🔒 Misafir karakterin sadece bu cihazda saklanır. Kayıt olursan karakterin hesabına taşınır.
          </Small>
        ) : (
          <Field label="Takma ad" value={name} onChangeText={setName} maxLength={24} />
        )}

        <H3 style={styles.section}>Saç modeli</H3>
        <Row style={{ flexWrap: 'wrap' }}>
          {HAIR_STYLES.map((h) => (
            <Chip key={h.key} label={h.label} active={cfg.hairStyle === h.key} onPress={() => set('hairStyle', h.key)} />
          ))}
        </Row>

        <H3 style={styles.section}>{cfg.hairStyle === 'bere' ? 'Saç rengi (bere altında)' : 'Saç rengi'}</H3>
        <Swatches colors={HAIR_COLORS} value={cfg.hairColor} onChange={(i) => set('hairColor', i)} />

        <H3 style={styles.section}>Ten rengi</H3>
        <Swatches colors={SKINS} value={cfg.skin} onChange={(i) => set('skin', i)} />

        <H3 style={styles.section}>Tişört</H3>
        <Swatches colors={SHIRTS} value={cfg.shirt} onChange={(i) => set('shirt', i)} />

        <H3 style={styles.section}>Aksesuar</H3>
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip label="Yok" active={!cfg.glasses} onPress={() => set('glasses', false)} />
          <Chip label="Gözlük" active={cfg.glasses} onPress={() => set('glasses', true)} />
        </Row>
      </Box>

      {error ? (
        <View style={{ marginTop: 14 }}>
          <Banner kind="error" text={error} />
        </View>
      ) : null}

      <Row style={{ gap: 12, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button title={first ? 'TAMAM, BAŞLA!' : 'KAYDET'} variant="success" onPress={save} loading={busy} style={{ flexGrow: 1 }} />
        {!first ? <Button small variant="secondary" title="Vazgeç" onPress={() => router.back()} /> : null}
      </Row>
    </View>
  );

  return (
    <Screen maxWidth={isWide ? 1000 : 480} contentStyle={{ paddingTop: isWide ? 40 : 16 }}>
      <H2 style={{ marginBottom: 4, fontSize: isWide ? 30 : 22 }}>{first ? 'Karakterini oluştur' : 'Karakterini düzenle'}</H2>
      <Small style={{ marginBottom: 18 }}>
        {guest ? 'Uygulamada bu pixel karakterle gezeceksin.' : 'Yorumlarda bu pixel karakterle görüneceksin.'}
      </Small>
      {isWide ? (
        <Row style={{ gap: 28, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>{stage}</View>
          <View style={{ flex: 1 }}>{controls}</View>
        </Row>
      ) : (
        <View style={{ gap: 16 }}>
          {stage}
          {controls}
        </View>
      )}
    </Screen>
  );
}

function Swatches({ colors: list, value, onChange }: { colors: string[]; value: number; onChange: (i: number) => void }) {
  return (
    <Row style={{ flexWrap: 'wrap', gap: 10 }}>
      {list.map((c, i) => (
        <Pressable
          key={c}
          onPress={() => onChange(i)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === i }}
          style={{
            width: 36,
            height: 36,
            backgroundColor: c,
            borderWidth: 3,
            borderColor: colors.ink,
            transform: value === i ? [{ translateY: -3 }] : undefined,
          }}
        >
          {value === i ? (
            <View style={{ position: 'absolute', bottom: -9, left: 11, width: 8, height: 4, backgroundColor: colors.ink }} />
          ) : null}
        </Pressable>
      ))}
    </Row>
  );
}

const styles = { section: { fontSize: 15, marginTop: 6, marginBottom: 8 } };
