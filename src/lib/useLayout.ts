import { Platform, useWindowDimensions } from 'react-native';

/** Uygulama telefonda/tablette (Android, iOS) mı çalışıyor? Web'de false. */
export const isNative = Platform.OS !== 'web';

/** Ekran genişliğine göre düzen kararları. Web'de geniş ekran düzeni, mobilde tek sütun. */
export function useLayout() {
  const { width } = useWindowDimensions();
  return {
    width,
    isNative,
    /** Masaüstü düzeni: yan yana sütunlar */
    isWide: width >= 900,
    /** Mekan kartı ızgarasında sütun sayısı */
    gridCols: width >= 1240 ? 3 : width >= 700 ? 2 : 1,
  };
}

export const PAGE_WIDTH = 1180;

/**
 * Geniş ekranda yan yana sütun, dar ekranda tam genişlik.
 * Not: dar ekranda (telefon) "flex" verilmez. Kaydırılan sayfanın içinde
 * flex: 1 telefonda kutunun yüksekliğini sıfıra indirir; içerik üst üste biner
 * ve sayfanın sonu kaydırılamaz. Webde bu sorun görünmez.
 */
export function column(isWide: boolean, flex = 1) {
  return isWide ? { flex, minWidth: 0 } : { width: '100%' as const };
}
