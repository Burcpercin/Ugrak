import { api } from './api';
import { guestStore } from './guestStore';

/**
 * Favoriler: giriş yapmış kullanıcıda hesapta, misafirde sadece bu cihazda.
 * Ekranlar hangisi olduğunu bilmeden bu iki fonksiyonu kullanır.
 */
export function loadFavorites(guest: boolean): Promise<string[]> {
  return guest ? guestStore.favorites() : api.listFavorites();
}

export function toggleFavorite(guest: boolean, venueId: string): Promise<boolean> {
  return guest ? guestStore.toggleFavorite(venueId) : api.toggleFavorite(venueId);
}
