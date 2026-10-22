import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, fonts } from '@/theme';

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 10 }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderWidth: 3,
          borderColor: colors.ink,
          backgroundColor: checked ? colors.green : colors.card,
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {checked ? <Text style={{ color: '#fff', fontFamily: fonts.pixel, fontSize: 14, lineHeight: 16 }}>✓</Text> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}
