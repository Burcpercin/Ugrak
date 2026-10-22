import React from 'react';
import { Tabs } from 'expo-router';
import { RequireStudent } from '@/components/RequireStudent';
import { PixelIcon } from '@/components/Avatar';
import { colors, fonts } from '@/theme';

export default function TabsLayout() {
  return (
    <RequireStudent>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.blue,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.paper,
            borderTopWidth: 3,
            borderTopColor: colors.ink,
            height: 64,
            paddingTop: 6,
          },
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
    </RequireStudent>
  );
}
