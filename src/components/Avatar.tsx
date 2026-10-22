import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import type { AvatarConfig } from '@/lib/types';
import { colors } from '@/theme';

// Basit pixel karakter (V1). 14x16 piksellik büst; saç modeli, renkler ve
// gözlük değiştirilebilir. Her piksel bir SVG kare olarak çizilir, böylece
// web, iOS ve Android'de aynı görünür.

export const SKINS = ['#F6D3B3', '#E3AE83', '#C08359', '#8A5536'];
export const HAIR_COLORS = ['#2A1A10', '#6B3E1F', '#C9852B', '#E8D27A', '#B23A48'];
export const SHIRTS = ['#2F6FDE', '#F28C28', '#2E9E4F', '#8E44AD', '#D9443A', '#3A4252'];
export const HAIR_STYLES: { key: AvatarConfig['hairStyle']; label: string }[] = [
  { key: 'kisa', label: 'Kısa' },
  { key: 'uzun', label: 'Uzun' },
  { key: 'bere', label: 'Bere' },
];

export const DEFAULT_AVATAR: AvatarConfig = { skin: 0, hairStyle: 'kisa', hairColor: 0, shirt: 0, glasses: false };

// O: dış hat, H: saç, S: ten, E: göz, M: ağız, T: tişört, G: gözlük, C: bere, .: boş
const BASE = [
  '....OOOOOO....',
  '...OHHHHHHO...',
  '..OHHHHHHHHO..',
  '..OHHHHHHHHO..',
  '..OHSSSSSSHO..',
  '..OSSSSSSSSO..',
  '..OSSESSESSO..',
  '..OSSSSSSSSO..',
  '..OSSSMMSSSO..',
  '...OSSSSSSO...',
  '....OOSSOO....',
  '..OOTTSSTTOO..',
  '.OTTTTTTTTTTO.',
  '.OTTTTTTTTTTO.',
  '.OTTTTTTTTTTO.',
  '.OOOOOOOOOOOO.',
];

function buildGrid(cfg: AvatarConfig): string[][] {
  const g = BASE.map((r) => r.split(''));
  if (cfg.hairStyle === 'uzun') {
    for (let y = 3; y <= 11; y++) {
      g[y][1] = 'H';
      g[y][12] = 'H';
      g[y][0] = 'O';
      g[y][13] = 'O';
    }
    g[2][1] = 'O';
    g[2][12] = 'O';
    g[11][2] = 'H';
    g[11][11] = 'H';
  }
  if (cfg.hairStyle === 'bere') {
    g[0] = '...OOOOOOOO...'.split('');
    g[1] = '..OCCCCCCCCO..'.split('');
    g[2] = '.OCCCCCCCCCCO.'.split('');
    g[3] = '.OOOOOOOOOOOO.'.split('');
  }
  if (cfg.glasses) {
    g[6] = '..OSGEGGEGSO..'.split('');
    g[5][4] = 'G';
    g[5][6] = 'G';
    g[5][7] = 'G';
    g[5][9] = 'G';
  }
  return g;
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, v + amt));
  const r = c((n >> 16) & 255);
  const g = c((n >> 8) & 255);
  const b = c(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function Avatar({
  config,
  size = 64,
  framed = false,
  bg,
}: {
  config: AvatarConfig | null | undefined;
  size?: number;
  framed?: boolean;
  bg?: string;
}) {
  const cfg = config ?? DEFAULT_AVATAR;
  const rects = useMemo(() => {
    const grid = buildGrid(cfg);
    const pal: Record<string, string> = {
      O: colors.ink,
      E: colors.ink,
      G: colors.ink,
      M: '#A9463E',
      H: HAIR_COLORS[cfg.hairColor] ?? HAIR_COLORS[0],
      S: SKINS[cfg.skin] ?? SKINS[0],
      T: SHIRTS[cfg.shirt] ?? SHIRTS[0],
      C: shade(SHIRTS[cfg.shirt] ?? SHIRTS[0], -40),
    };
    const out: React.ReactElement[] = [];
    grid.forEach((row, y) =>
      row.forEach((ch, x) => {
        if (ch === '.') return;
        out.push(<Rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={pal[ch]} />);
      }),
    );
    return out;
  }, [cfg.skin, cfg.hairStyle, cfg.hairColor, cfg.shirt, cfg.glasses]);

  const svg = (
    <Svg width={size} height={(size * 16) / 14} viewBox="0 0 14 16">
      {rects}
    </Svg>
  );
  if (!framed) return svg;
  return (
    <View
      style={{
        borderWidth: 3,
        borderColor: colors.ink,
        backgroundColor: bg ?? colors.blueSoft,
        padding: size * 0.12,
        alignItems: 'center',
        justifyContent: 'flex-end',
        alignSelf: 'flex-start',
      }}
    >
      {svg}
    </View>
  );
}

export function randomAvatar(): AvatarConfig {
  const pick = (n: number) => Math.floor(Math.random() * n);
  return {
    skin: pick(SKINS.length),
    hairStyle: HAIR_STYLES[pick(HAIR_STYLES.length)].key,
    hairColor: pick(HAIR_COLORS.length),
    shirt: pick(SHIRTS.length),
    glasses: Math.random() < 0.35,
  };
}

// ---------------------------------------------------------------------
// Sekme çubuğu için küçük pixel ikonlar (7x7)
// ---------------------------------------------------------------------

const ICONS: Record<string, string[]> = {
  kesfet: ['..XXX..', '.X...X.', 'X..X..X', 'X.XXX.X', 'X..X..X', '.X...X.', '..XXX..'],
  kampanya: ['XXXXXXX', 'X.....X', 'X.X.X.X', '.......', 'X.X.X.X', 'X.....X', 'XXXXXXX'],
  profil: ['..XXX..', '.XXXXX.', '.XXXXX.', '..XXX..', '.......', 'XXXXXXX', 'XXXXXXX'],
};

export function PixelIcon({ name, color, size = 22 }: { name: keyof typeof ICONS | string; color: string; size?: number }) {
  const map = ICONS[name] ?? ICONS.kesfet;
  return (
    <Svg width={size} height={size} viewBox="0 0 7 7">
      {map.flatMap((row, y) =>
        row.split('').map((ch, x) =>
          ch === 'X' ? <Rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={color} /> : null,
        ),
      )}
    </Svg>
  );
}
