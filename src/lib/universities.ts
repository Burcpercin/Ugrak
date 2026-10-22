import type { University } from './types';

// supabase/schema.sql içindeki üniversite listesinin istemci tarafı kopyası.
// Kayıt ekranında anında geri bildirim vermek için kullanılır;
// asıl kontrolü veritabanındaki tetikleyici yapar.
// NOT: Öğrenci/personel ayrımı için her üniversitenin öğrenci mail formatı
// ayrıca doğrulanmalıdır (bkz. Gereksinim Analizi, Riskler).
export const UNIVERSITIES: University[] = [
  { id: 1, name: 'İstanbul Arel Üniversitesi', short_name: 'Arel', domains: ['istanbularel.edu.tr'], campus_name: 'Tepekent Yerleşkesi', lat: 41.0627, lng: 28.5937 },
  { id: 2, name: 'İstanbul Teknik Üniversitesi', short_name: 'İTÜ', domains: ['itu.edu.tr'], campus_name: 'Ayazağa Yerleşkesi', lat: 41.1055, lng: 29.0254 },
  { id: 3, name: 'Boğaziçi Üniversitesi', short_name: 'Boğaziçi', domains: ['bogazici.edu.tr', 'boun.edu.tr'], campus_name: 'Güney Kampüs', lat: 41.0839, lng: 29.051 },
  { id: 4, name: 'Yıldız Teknik Üniversitesi', short_name: 'YTÜ', domains: ['yildiz.edu.tr'], campus_name: 'Davutpaşa Kampüsü', lat: 41.0256, lng: 28.8897 },
  { id: 5, name: 'Marmara Üniversitesi', short_name: 'Marmara', domains: ['marmara.edu.tr', 'marun.edu.tr'], campus_name: 'Göztepe Kampüsü', lat: 40.9874, lng: 29.057 },
  { id: 6, name: 'İstanbul Üniversitesi', short_name: 'İÜ', domains: ['istanbul.edu.tr', 'iu.edu.tr'], campus_name: 'Beyazıt Kampüsü', lat: 41.0129, lng: 28.9637 },
  { id: 7, name: 'Bahçeşehir Üniversitesi', short_name: 'BAU', domains: ['bau.edu.tr'], campus_name: 'Beşiktaş Kampüsü', lat: 41.042, lng: 29.0091 },
  { id: 8, name: 'İstanbul Bilgi Üniversitesi', short_name: 'Bilgi', domains: ['bilgi.edu.tr'], campus_name: 'santralistanbul', lat: 41.067, lng: 28.9466 },
  { id: 9, name: 'Kadir Has Üniversitesi', short_name: 'KHAS', domains: ['khas.edu.tr'], campus_name: 'Cibali Kampüsü', lat: 41.0247, lng: 28.959 },
  { id: 10, name: 'Galatasaray Üniversitesi', short_name: 'GSÜ', domains: ['gsu.edu.tr'], campus_name: 'Ortaköy Kampüsü', lat: 41.0466, lng: 29.0226 },
  { id: 11, name: 'Özyeğin Üniversitesi', short_name: 'Özyeğin', domains: ['ozyegin.edu.tr'], campus_name: 'Çekmeköy Kampüsü', lat: 41.0306, lng: 29.2589 },
  { id: 12, name: 'Koç Üniversitesi', short_name: 'Koç', domains: ['ku.edu.tr'], campus_name: 'Rumelifeneri Kampüsü', lat: 41.205, lng: 29.072 },
];

export function universityForEmail(email: string): University | null {
  const domain = email.trim().toLowerCase().split('@')[1];
  if (!domain) return null;
  let best: { u: University; len: number } | null = null;
  for (const u of UNIVERSITIES) {
    for (const d of u.domains) {
      if (domain === d || domain.endsWith('.' + d)) {
        if (!best || d.length > best.len) best = { u, len: d.length };
      }
    }
  }
  return best?.u ?? null;
}

export function universityById(id: number | null | undefined) {
  return UNIVERSITIES.find((u) => u.id === id) ?? null;
}

export type EmailCheck =
  | { ok: true; university: University }
  | { ok: false; reason: string };

export function checkStudentEmail(raw: string): EmailCheck {
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: 'Geçerli bir e-posta adresi gir.' };
  }
  if (!email.endsWith('.edu.tr')) {
    return { ok: false, reason: 'Sadece üniversitenin verdiği .edu.tr adresiyle kayıt olunabilir.' };
  }
  const u = universityForEmail(email);
  if (!u) {
    return {
      ok: false,
      reason: 'Bu adres listemizdeki İstanbul üniversitelerinden birine ait değil. Uğrak şimdilik sadece İstanbul’da.',
    };
  }
  return { ok: true, university: u };
}

/** İki nokta arası kuş uçuşu mesafe (metre). */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}
