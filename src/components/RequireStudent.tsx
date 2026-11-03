import React from 'react';
import { AuthGate } from './AuthGate';

/**
 * Sadece doğrulaması geçerli öğrencilerin göreceği ekranları korur.
 * Oturum yoksa girişe, doğrulama süresi dolduysa yeniden doğrulamaya,
 * avatar yoksa avatar oluşturucuya yönlendirir. Ayrıntı: AuthGate.
 */
export function RequireStudent({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}

/**
 * Herkese açık gezinme ekranları (Keşfet, Kampanyalar, Profil, mekan detayı).
 * Misafir de girer; giriş yapmış kullanıcının profil/karakter eksikleri yine tamamlatılır.
 */
export function OpenToGuests({ children }: { children: React.ReactNode }) {
  return <AuthGate allowGuest>{children}</AuthGate>;
}
