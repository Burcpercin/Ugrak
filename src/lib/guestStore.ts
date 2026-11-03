import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AvatarConfig } from './types';

// =====================================================================
// MİSAFİR VERİSİ — sadece bu cihazda
// Giriş yapmadan kullanan kişinin favorileri ve karakteri sunucuya hiç
// gönderilmez; telefonda AsyncStorage'da, web'de tarayıcının yerel
// deposunda durur. Kayıt olunca favoriler hesaba taşınır ve buradan silinir.
// Depo bazı durumlarda (gizli sekme, kapalı site verisi) kullanılamayabilir;
// o zaman sessizce boş döner, uygulama yine çalışır.
// =====================================================================

const K_FAV = 'ugrak.misafir.favoriler';
const K_AVATAR = 'ugrak.misafir.karakter';

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function write(key: string, value: unknown) {
  try {
    if (value == null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // depo kullanılamıyor: bu oturumda bellekte kalır
  }
}

const isId = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x);

export const guestStore = {
  async favorites(): Promise<string[]> {
    const list = await read<unknown>(K_FAV, []);
    return Array.isArray(list) ? list.filter(isId).slice(0, 200) : [];
  },

  async toggleFavorite(venueId: string): Promise<boolean> {
    const list = await guestStore.favorites();
    const has = list.includes(venueId);
    await write(K_FAV, has ? list.filter((x) => x !== venueId) : [...list, venueId]);
    return !has;
  },

  async clearFavorites() {
    await write(K_FAV, null);
  },

  async avatar(): Promise<AvatarConfig | null> {
    const a = await read<AvatarConfig | null>(K_AVATAR, null);
    return a && typeof a === 'object' ? a : null;
  },

  async setAvatar(a: AvatarConfig | null) {
    await write(K_AVATAR, a);
  },
};
