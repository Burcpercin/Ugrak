// Uğrak görsel dili: retro-pixel. Kalın siyah çerçeve, sert gölge, mavi + turuncu.

export const colors = {
  bg: '#FFF4DE',
  paper: '#FFFBF2',
  card: '#FFFFFF',
  ink: '#1B1B1B',
  muted: '#6A6257',
  line: '#1B1B1B',
  blue: '#2F6FDE',
  blueSoft: '#DCE8FF',
  orange: '#F28C28',
  orangeSoft: '#FFE6CC',
  green: '#2E9E4F',
  greenSoft: '#D9F2DF',
  red: '#D9443A',
  redSoft: '#FBDCD9',
  yellow: '#F7C548',
  grey: '#E7E1D6',
};

export const fonts = {
  pixel: 'PixelifySans_700Bold',
  pixelRegular: 'PixelifySans_500Medium',
};

export const radius = 0; // pixel tarzı: köşe yok
export const border = 3;
export const shadow = 4;

// Kriterler: veritabanındaki sütun adları ile eşleşir.
export const CRITERIA = [
  { key: 'price', label: 'Fiyat', hint: 'Fiyat / performans' },
  { key: 'study', label: 'Ders', hint: 'Ders çalışmaya uygunluk (priz, wifi, sessizlik)' },
  { key: 'portion', label: 'Porsiyon', hint: 'Porsiyon büyüklüğü' },
  { key: 'vibe', label: 'Ortam', hint: 'Ortam ve atmosfer' },
] as const;

export type CriterionKey = (typeof CRITERIA)[number]['key'];

export const CATEGORY_LABEL: Record<string, string> = {
  kafe: 'Kafe',
  restoran: 'Restoran',
  fastfood: 'Fast food',
  tatli: 'Tatlıcı',
  bar: 'Bar',
  'kutuphane-kafe': 'Çalışma kafe',
};

export function scoreColor(v: number | null | undefined) {
  if (v == null) return colors.grey;
  if (v >= 4) return colors.green;
  if (v >= 3) return colors.yellow;
  return colors.red;
}
