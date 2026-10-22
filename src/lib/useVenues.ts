import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api, errorMessage } from './api';
import type { VenueListItem } from './types';

/** Mekan listesini ve favorileri yükler; ekrana her dönüldüğünde tazeler. */
export function useVenues() {
  const [venues, setVenues] = useState<VenueListItem[] | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [v, f] = await Promise.all([api.listVenues(), api.listFavorites()]);
      setVenues(v);
      setFavorites(f);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggleFavorite = useCallback(async (id: string) => {
    setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
    try {
      await api.toggleFavorite(id);
    } catch {
      // geri al
      setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
    }
  }, []);

  return { venues, favorites, error, reload: load, toggleFavorite };
}
