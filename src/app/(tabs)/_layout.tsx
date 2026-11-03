import React from 'react';
import { Tabs } from 'expo-router';
import { OpenToGuests } from '@/components/RequireStudent';
import { PixelIcon } from '@/components/Avatar';
import { isNative } from '@/lib/useLayout';
import { colors, fonts } from '@/theme';

export default function TabsLayout() {
  return (
    <OpenToGuests>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.blue,
          tabBarInactiveTintColor: colors.muted,
          // Web'de gezinme üstteki menüden (TopNav) yapılır, alt çubuk gizli.
          // Telefonda alt sekme çubuğu görünür; alttaki güvenli alanı kendisi ayarlar.
          tabBarStyle: isNative
            ? { backgroundColor: colors.paper, borderTopWidth: 3, borderTopColor: colors.ink, paddingTop: 6 }
            : { display: 'none' },
          tabBarLabelStyle: { fontFamily: fonts.pixel, fontSize: 12 },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen
          name="kesfet"
          options={{ title: 'Keşfet', tabBarIcon: ({ color }) => <PixelIcon name="kesfet" color={String(color)} /> }}
        />
        <Tabs.Screen
          name="kampanyalar"
          options={{ title: 'Kampanyalar', tabBarIcon: ({ color }) => <PixelIcon name="kampanya" color={String(color)} /> }}
        />
        <Tabs.Screen
          name="profil"
          options={{ title: 'Profil', tabBarIcon: ({ color }) => <PixelIcon name="profil" color={String(color)} /> }}
        />
      </Tabs>
    </OpenToGuests>
  );
}
