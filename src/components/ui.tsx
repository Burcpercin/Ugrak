import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { border, colors, fonts, scoreColor, shadow } from '@/theme';

// ---------------------------------------------------------------------
// Yazı
// ---------------------------------------------------------------------

type TProps = {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

export const H1 = ({ children, style }: TProps) => <Text style={[s.h1, style]}>{children}</Text>;
export const H2 = ({ children, style }: TProps) => <Text style={[s.h2, style]}>{children}</Text>;
export const H3 = ({ children, style, numberOfLines }: TProps) => (
  <Text style={[s.h3, style]} numberOfLines={numberOfLines}>
    {children}
  </Text>
);
export const P = ({ children, style, numberOfLines }: TProps) => (
  <Text style={[s.p, style]} numberOfLines={numberOfLines}>
    {children}
  </Text>
);
export const Small = ({ children, style, numberOfLines }: TProps) => (
  <Text style={[s.small, style]} numberOfLines={numberOfLines}>
    {children}
  </Text>
);

// ---------------------------------------------------------------------
// Sayfa iskeleti
// ---------------------------------------------------------------------

export function Screen({
  children,
  wide = false,
  scroll = true,
  bg = colors.bg,
  contentStyle,
}: {
  children: React.ReactNode;
  wide?: boolean;
  scroll?: boolean;
  bg?: string;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const inner = <View style={[s.inner, { maxWidth: wide ? 1180 : 480 }, contentStyle]}>{children}</View>;
  return (
    <View style={[s.screen, { backgroundColor: bg }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </View>
  );
}

// ---------------------------------------------------------------------
// Pixel kutu: kalın çerçeve + sert gölge (her platformda aynı görünür)
// ---------------------------------------------------------------------

export function Box({
  children,
  style,
  bg = colors.card,
  shadowOffset = shadow,
  onPress,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  bg?: string;
  shadowOffset?: number;
  onPress?: () => void;
  padded?: boolean;
}) {
  const content = (pressed: boolean) => (
    <View style={[{ marginRight: shadowOffset, marginBottom: shadowOffset }, style]}>
      <View
        style={[
          s.shadow,
          { top: shadowOffset, left: shadowOffset, right: -shadowOffset, bottom: -shadowOffset },
        ]}
      />
      <View
        style={[
          s.box,
          { backgroundColor: bg },
          padded && { padding: 14 },
          pressed && { transform: [{ translateX: 2 }, { translateY: 2 }] },
        ]}
      >
        {children}
      </View>
    </View>
  );
  if (!onPress) return content(false);
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

// ---------------------------------------------------------------------
// Buton
// ---------------------------------------------------------------------

const BTN = {
  primary: { bg: colors.blue, fg: '#fff' },
  accent: { bg: colors.orange, fg: colors.ink },
  success: { bg: colors.green, fg: '#fff' },
  secondary: { bg: colors.card, fg: colors.ink },
  danger: { bg: colors.red, fg: '#fff' },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  small,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: keyof typeof BTN;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = BTN[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={off ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      style={[{ marginRight: 3, marginBottom: 3, opacity: off ? 0.55 : 1 }, style]}
    >
      {({ pressed }) => (
        <View>
          <View style={[s.shadow, { top: 3, left: 3, right: -3, bottom: -3 }]} />
          <View
            style={[
              s.btn,
              small && s.btnSmall,
              { backgroundColor: c.bg },
              pressed && !off && { transform: [{ translateX: 3 }, { translateY: 3 }] },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={c.fg} />
            ) : (
              <Text style={[s.btnText, small && { fontSize: 14 }, { color: c.fg }]}>{title}</Text>
            )}
          </View>
        </View>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------
// Form alanı
// ---------------------------------------------------------------------

export function Field({
  label,
  error,
  hint,
  style,
  ...rest
}: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#9C9488"
        autoCorrect={false}
        style={[s.input, error ? { borderColor: colors.red } : null, style]}
        {...rest}
      />
      {error ? <Small style={{ color: colors.red, marginTop: 4 }}>{error}</Small> : null}
      {!error && hint ? <Small style={{ marginTop: 4 }}>{hint}</Small> : null}
    </View>
  );
}

// ---------------------------------------------------------------------
// Küçük parçalar
// ---------------------------------------------------------------------

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, active && { backgroundColor: colors.ink }]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      <Text style={[s.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ text, bg = colors.yellow, fg = colors.ink }: { text: string; bg?: string; fg?: string }) {
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function Banner({
  kind = 'info',
  title,
  text,
  children,
}: {
  kind?: 'info' | 'warn' | 'error' | 'ok' | 'demo';
  title?: string;
  text?: string;
  children?: React.ReactNode;
}) {
  const bg = {
    info: colors.blueSoft,
    warn: colors.orangeSoft,
    error: colors.redSoft,
    ok: colors.greenSoft,
    demo: '#FFF0A8',
  }[kind];
  return (
    <View style={[s.banner, { backgroundColor: bg }]}>
      {title ? <Text style={s.bannerTitle}>{title}</Text> : null}
      {text ? <P style={{ fontSize: 14 }}>{text}</P> : null}
      {children}
    </View>
  );
}

/** 5 kareli kriter çubuğu */
export function ScoreBar({ label, value, compact }: { label: string; value: number | null; compact?: boolean }) {
  const filled = value == null ? 0 : Math.round(value);
  const col = scoreColor(value);
  return (
    <View style={[s.scoreRow, compact && { marginBottom: 3 }]}>
      <Text style={[s.scoreLabel, compact && { width: 62, fontSize: 11 }]}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 3, flex: 1 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[
              s.scoreCell,
              compact && { height: 8 },
              { backgroundColor: i <= filled ? col : colors.paper },
            ]}
          />
        ))}
      </View>
      <Text style={[s.scoreVal, compact && { fontSize: 11, width: 26 }]}>{value == null ? '–' : value.toFixed(1)}</Text>
    </View>
  );
}

/** Büyük puan karesi */
export function ScoreTile({ value, size = 54 }: { value: number | null; size?: number }) {
  return (
    <View
      style={[
        s.scoreTile,
        { width: size, height: size, backgroundColor: scoreColor(value) },
      ]}
    >
      <Text style={[s.scoreTileText, { fontSize: size * 0.38 }]}>{value == null ? '–' : value.toFixed(1)}</Text>
    </View>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: 2, backgroundColor: colors.ink, opacity: 0.12, marginVertical: 12 }} />;
}

export function Loading() {
  return (
    <View style={{ padding: 40, alignItems: 'center' }}>
      <ActivityIndicator color={colors.blue} size="large" />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  inner: { width: '100%', alignSelf: 'center', paddingHorizontal: 16, paddingTop: 16 },

  h1: { fontFamily: fonts.pixel, fontSize: 30, color: colors.ink, letterSpacing: 0.5 },
  h2: { fontFamily: fonts.pixel, fontSize: 22, color: colors.ink },
  h3: { fontFamily: fonts.pixel, fontSize: 17, color: colors.ink },
  p: { fontSize: 15, lineHeight: 21, color: colors.ink },
  small: { fontSize: 12.5, lineHeight: 17, color: colors.muted },

  shadow: { position: 'absolute', backgroundColor: colors.ink },
  box: { borderWidth: border, borderColor: colors.line },

  btn: {
    borderWidth: border,
    borderColor: colors.line,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 12, minHeight: 36 },
  btnText: { fontFamily: fonts.pixel, fontSize: 17, letterSpacing: 0.5 },

  label: { fontFamily: fonts.pixel, fontSize: 14, marginBottom: 6, color: colors.ink },
  input: {
    borderWidth: border,
    borderColor: colors.line,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: colors.ink,
  },

  chip: {
    borderWidth: 2,
    borderColor: colors.line,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.card,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: { fontFamily: fonts.pixel, fontSize: 13, color: colors.ink },

  badge: { borderWidth: 2, borderColor: colors.line, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  badgeText: { fontFamily: fonts.pixel, fontSize: 11, letterSpacing: 0.5 },

  banner: { borderWidth: border, borderColor: colors.line, padding: 12, marginBottom: 14 },
  bannerTitle: { fontFamily: fonts.pixel, fontSize: 15, marginBottom: 4, color: colors.ink },

  scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  scoreLabel: { width: 76, fontFamily: fonts.pixel, fontSize: 13, color: colors.ink },
  scoreCell: { flex: 1, height: 12, borderWidth: 2, borderColor: colors.line },
  scoreVal: { width: 32, textAlign: 'right', fontWeight: '800', fontSize: 13, color: colors.ink },

  scoreTile: { borderWidth: border, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  scoreTileText: { fontWeight: '900', color: colors.ink },
});
