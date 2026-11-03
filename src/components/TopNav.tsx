import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/lib/auth';
import { useLayout, PAGE_WIDTH } from '@/lib/useLayout';
import { universityById } from '@/lib/universities';
import { isDemo } from '@/lib/api';
import { colors, fonts } from '@/theme';
import { Avatar, PixelIcon } from './Avatar';
import { Logo } from './Brand';
import { Badge } from './ui';

const LINKS = [
  { href: '/kesfet', label: 'Keşfet', icon: 'kesfet' },
  { href: '/kampanyalar', label: 'Kampanyalar', icon: 'kampanya' },
  { href: '/profil', label: 'Profil', icon: 'profil' },
] as const;

/** Öğrenci tarafının üst menüsü. Web'de tam menü, telefonda sade başlık. */
export function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, avatar, access } = useAuth();
  const { isWide, isNative } = useLayout();
  const insets = useSafeAreaInsets();
  const uni = universityById(profile?.university_id);

  const active = (href: string) =>
    pathname === href || (href === '/kesfet' && pathname.startsWith('/mekan'));

  // Telefonda: sade başlık (logo + avatar). Sayfalar arası geçiş alttaki sekme çubuğundan.
  if (isNative) {
    return (
      <View
        style={{
          backgroundColor: colors.paper,
          borderBottomWidth: 3,
          borderColor: colors.ink,
          paddingTop: insets.top + 8,
          paddingBottom: 10,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => router.navigate('/kesfet')} accessibilityRole="link" accessibilityLabel="Uğrak ana sayfa">
            <Logo size={24} />
          </Pressable>
          {isDemo ? <Badge text="DEMO" /> : null}
        </View>
        <Pressable onPress={() => router.navigate('/profil')} accessibilityRole="link" accessibilityLabel="Profilim" hitSlop={8}>
          <Avatar config={avatar} size={28} framed bg={colors.orangeSoft} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.paper, borderBottomWidth: 3, borderColor: colors.ink }}>
      <View
        style={{
          width: '100%',
          maxWidth: PAGE_WIDTH,
          alignSelf: 'center',
          paddingHorizontal: 16,
          paddingVertical: 10,
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: isWide ? 28 : 10,
        }}
      >
        <Pressable onPress={() => router.push('/kesfet')} accessibilityRole="link" accessibilityLabel="Uğrak ana sayfa">
          <Logo size={isWide ? 30 : 24} />
        </Pressable>
        {isDemo && isWide ? <Badge text="DEMO" /> : null}

        <View style={{ flexDirection: 'row', gap: 6, flexGrow: 1, flexWrap: 'wrap' }}>
          {LINKS.map((l) => {
            const on = active(l.href);
            return (
              <Pressable
                key={l.href}
                onPress={() => router.push(l.href)}
                accessibilityRole="link"
                accessibilityState={{ selected: on }}
                style={({ hovered }: any) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderWidth: 3,
                  borderColor: on ? colors.ink : 'transparent',
                  backgroundColor: on ? colors.orange : hovered ? colors.orangeSoft : 'transparent',
                })}
              >
                <PixelIcon name={l.icon} color={colors.ink} size={16} />
                <Text style={{ fontFamily: fonts.pixel, fontSize: 15, color: colors.ink }}>{l.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => router.push('/profil')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
          accessibilityRole="link"
          accessibilityLabel="Profilim"
        >
          {isWide ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontFamily: fonts.pixel, fontSize: 14, color: colors.ink }}>
                {access === 'guest' ? 'Misafir' : profile?.display_name}
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {access === 'guest'
                  ? 'Giriş yap / kayıt ol'
                  : `${uni?.short_name ?? ''} · ${access === 'student' ? 'Öğrenci' : 'Doğrulama gerekli'}`}
              </Text>
            </View>
          ) : null}
          <Avatar config={avatar} size={30} framed bg={colors.orangeSoft} />
        </Pressable>
      </View>
    </View>
  );
}
