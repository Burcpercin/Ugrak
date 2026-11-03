import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api, errorMessage } from './api';
import { useAuth } from './auth';
import { loadFavorites, toggleFavorite as toggleFav } from './favorites';
import type { VenueListItem } from './types';

/** Mekan listesini ve favorileri yükler; ekrana her dönüldüğünde tazeler. */
export function useVenues() {
  const { access } = useAuth();
  const guest = access === 'guest';
  const [venues, setVenues] = useState<VenueListItem[] | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [v, f] = await Promise.all([api.listVenues(), loadFavorites(guest).catch(() => [] as string[])]);
      setVenues(v);
      setFavorites(f);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [guest]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const flip = (f: string[]) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]);
      setFavorites(flip);
      try {
        await toggleFav(guest, id);
      } catch {
        setFavorites(flip); // geri al
      }
    },
    [guest],
  );

  return { venues, favorites, error, reload: load, toggleFavorite };
}
