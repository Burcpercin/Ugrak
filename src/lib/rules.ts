// =====================================================================
// ORTAK KURALLAR
// Veritabanındaki kuralların (supabase/2026-11-05-faz2-paneller.sql)
// uygulamadaki kopyası. Formlar kullanıcıya anında uyarı vermek, demo modu
// da veritabanıyla aynı davranmak için bunu kullanır. Asıl kontrolü her
// zaman veritabanı yapar; burası sadece kolaylık.
// =====================================================================

import type { CampaignInput, RedeemReason, VenueInput } from './types';

export const CATEGORY_KEYS = ['kafe', 'restoran', 'fastfood', 'tatli', 'bar', 'kutuphane-kafe'] as const;

/** İstanbul il sınırları (yaklaşık) */
export const ISTANBUL = { latMin: 40.8, latMax: 41.6, lngMin: 27.9, lngMax: 29.95 };

export const MAX_LIVE_CAMPAIGNS = 3;
export const MAX_CAMPAIGN_DAYS = 90;
export const MAX_START_AHEAD_DAYS = 30;
export const REDEEM_FAIL_LIMIT = 20; // 10 dakikada
const DAY = 24 * 3600 * 1000;

export function inIstanbul(lat: number, lng: number) {
  return lat >= ISTANBUL.latMin && lat <= ISTANBUL.latMax && lng >= ISTANBUL.lngMin && lng <= ISTANBUL.lngMax;
}

/**
 * Google Haritalar'dan kopyalanan konumu çözer:
 *  "41.0627, 28.5937" · "41,0627 28,5937" · ".../@41.0627,28.5937,17z" bağlantısı
 */
export function parseLatLng(text: string): { lat: number; lng: number } | null {
  const t = text.trim();
  const at = t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: Number(at[1]), lng: Number(at[2]) };
  const q = t.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (q) return { lat: Number(q[1]), lng: Number(q[2]) };
  // "41.06, 28.59" ya da "41,06 28,59" (Türkçe ondalık virgül)
  const dot = t.match(/^(-?\d{1,2}\.\d+)\s*[,;\s]\s*(-?\d{1,2}\.\d+)$/);
  if (dot) return { lat: Number(dot[1]), lng: Number(dot[2]) };
  const comma = t.match(/^(-?\d{1,2}),(\d+)\s+(-?\d{1,2}),(\d+)$/);
  if (comma) return { lat: Number(`${comma[1]}.${comma[2]}`), lng: Number(`${comma[3]}.${comma[4]}`) };
  return null;
}

export function validateVenue(v: VenueInput): string | null {
  if (v.name.trim().length < 2 || v.name.trim().length > 80) return 'Mekan adı 2-80 karakter olmalı.';
  if (!(CATEGORY_KEYS as readonly string[]).includes(v.category)) return 'Kategori seç.';
  if (v.district.trim().length < 2 || v.district.trim().length > 40) return 'Semt 2-40 karakter olmalı.';
  if ((v.address ?? '').length > 160) return 'Adres en fazla 160 karakter.';
  if ((v.description ?? '').length > 300) return 'Açıklama en fazla 300 karakter.';
  if (!Number.isFinite(v.lat) || !Number.isFinite(v.lng)) return 'Konumu gir (Google Haritalar’dan kopyalayabilirsin).';
  if (!inIstanbul(v.lat, v.lng)) return 'Konum İstanbul sınırları içinde olmalı.';
  if (![1, 2, 3].includes(v.price_level)) return 'Fiyat seviyesi seç.';
  return null;
}

/**
 * Okutulan ya da yazılan kodu temizler: "UGRAK:ab12-cd" → "AB12CD".
 * Geçerli 6 karakter çıkmazsa null.
 */
export function normalizeCode(raw: string): string | null {
  let c = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.startsWith('UGRAK') && c.length === 11) c = c.slice(5);
  return c.length === 6 ? c : null;
}

export function validateCampaign(c: CampaignInput, now = Date.now()): string | null {
  const title = c.title.trim();
  const discount = c.discount_text.trim();
  if (title.length < 2 || title.length > 60) return 'Başlık 2-60 karakter olmalı.';
  if (discount.length < 1 || discount.length > 40) return 'İndirim metni 1-40 karakter olmalı (ör. "%20 indirim").';
  if ((c.description ?? '').length > 200) return 'Açıklama en fazla 200 karakter.';
  const s = new Date(c.starts_at).getTime();
  const e = new Date(c.ends_at).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 'Tarihleri seç.';
  if (s < now - 10 * 60 * 1000) return 'Başlangıç geçmişte olamaz.';
  if (s > now + MAX_START_AHEAD_DAYS * DAY) return `Kampanya en fazla ${MAX_START_AHEAD_DAYS} gün sonrasına planlanabilir.`;
  if (e <= s) return 'Bitiş, başlangıçtan sonra olmalı.';
  if (e - s > MAX_CAMPAIGN_DAYS * DAY) return `Bir kampanya en fazla ${MAX_CAMPAIGN_DAYS} gün sürebilir.`;
  return null;
}

/** Kod doğrulama sonucunun mekan sahibine gösterilecek açıklaması. */
export const REDEEM_TEXT: Record<RedeemReason, { title: string; text: string }> = {
  OK: { title: 'KOD ONAYLANDI', text: 'İndirimi uygulayabilirsin.' },
  USED: { title: 'KOD DAHA ÖNCE KULLANILMIŞ', text: 'Aynı kod ikinci kez kullanılamaz.' },
  EXPIRED: { title: 'KODUN SÜRESİ DOLMUŞ', text: 'Kodlar 10 dakika geçerli. Öğrenci uygulamadan yeni kod alabilir.' },
  NOT_FOUND: { title: 'KOD BULUNAMADI', text: 'Kod yanlış yazılmış ya da başka bir mekana ait.' },
  FORMAT: { title: 'KOD 6 KARAKTER OLMALI', text: 'Harf ve rakamlardan oluşur, ör. K7MQ2X.' },
  STOPPED: { title: 'KAMPANYA DURDURULMUŞ', text: 'Bu kampanya durdurulduğu ya da mekan kapatıldığı için kod kabul edilmiyor.' },
  LIMIT: { title: 'ÇOK FAZLA HATALI DENEME', text: 'Güvenlik için 10 dakika bekle, sonra tekrar dene.' },
};

/** Süre seçenekleri (tarih seçici yerine; saat dilimi karışıklığı olmaz) */
export const DURATIONS: { label: string; days: number }[] = [
  { label: '1 gün', days: 1 },
  { label: '3 gün', days: 3 },
  { label: '1 hafta', days: 7 },
  { label: '2 hafta', days: 14 },
  { label: '1 ay', days: 30 },
  { label: '3 ay', days: 90 },
];
