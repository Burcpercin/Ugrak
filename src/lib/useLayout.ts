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
