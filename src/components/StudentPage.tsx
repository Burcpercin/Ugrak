import React from 'react';
import { View } from 'react-native';
import { PAGE_WIDTH, isNative } from '@/lib/useLayout';
import { colors } from '@/theme';
import { TopNav } from './TopNav';
import { Screen } from './ui';

/**
 * Öğrenci sayfalarının ortak iskeleti: üst menü + içerik alanı.
 * hasTabBar: sayfa alt sekme çubuğunun içinde (Keşfet, Kampanyalar, Profil);
 * o durumda alttaki güvenli alanı sekme çubuğu kendisi bırakır.
 */
export function StudentPage({ children, hasTabBar = false }: { children: React.ReactNode; hasTabBar?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <TopNav />
      <Screen
        maxWidth={PAGE_WIDTH}
        contentStyle={{ paddingTop: isNative ? 16 : 22 }}
        safeTop={false}
        safeBottom={!hasTabBar}
      >
        {children}
      </Screen>
    </View>
  );
}
