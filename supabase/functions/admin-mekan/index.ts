// =====================================================================
//  UĞRAK — admin-mekan (Supabase Edge Function)
//  Sadece admin çağırabilir. Mekan sahibi hesabını açmak gibi, uygulamanın
//  kendi anahtarıyla yapılamayan işleri tam yetkili anahtarla yapar.
//
//  İşlemler (POST gövdesinde "action"):
//   - approve       Başvuruyu onayla: mekanı aç, sahip hesabını aç ya da
//                   mevcut sahip hesabına ekle, sahibine "şifreni belirle" maili.
//   - assignOwner   Var olan bir mekana sahip ata (ör. yanlış e-posta düzeltmesi).
//   - resendInvite  Sahibine şifre belirleme mailini yeniden gönder.
//
//  Güvenlik:
//   - Çağıranın oturum anahtarı doğrulanır, profili "admin" değilse 403.
//   - Veritabanı fonksiyonları (admin_prepare_owner, admin_attach_venue)
//     sadece bu anahtarla çağrılabilir ve admin kimliğini tekrar kontrol eder.
//   - Hesap açıldıktan sonra mekan açılamazsa yeni hesap geri silinir;
//     yarım kalmış hesap oluşmaz.
//   - Tam yetkili anahtar sadece Supabase'in sunucusunda kalır; uygulamaya
//     ve GitHub'a hiçbir zaman girmez.
//
//  Kurulum: Supabase → Edge Functions → Deploy a new function → Via Editor →
//  adı "admin-mekan" → bu dosyanın tamamını yapıştır → Deploy function.
// =====================================================================

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CATEGORIES = ['kafe', 'restoran', 'fastfood', 'tatli', 'bar', 'kutuphane-kafe'];

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

/** Tam yetkili anahtar: yeni "secret key" varsa onu, yoksa eski service_role anahtarını kullan. */
function secretKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    if (typeof keys.default === 'string' && keys.default) return keys.default;
  } catch {
    // eski projelerde yok
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!legacy) throw new HttpError(500, 'Sunucu anahtarı bulunamadı.');
  return legacy;
}

/** Veritabanının "UGRAK_KOD: mesaj" biçimindeki hatasından mesajı çıkar. */
function dbMessage(e: { message?: string } | null, fallback: string) {
  const m = (e?.message ?? '').match(/UGRAK_[A-Z_]+:\s*(.*)$/);
  if (m) return m[1];
  if (/venues_fields/.test(e?.message ?? '')) {
    return 'Mekan bilgileri geçersiz: ad 2-80, semt 2-40 karakter olmalı ve konum İstanbul içinde olmalı.';
  }
  return fallback;
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** Şifre linkinin döneceği adres: sadece uygulamanın kendi adres türleri. */
function safeRedirect(v: unknown): string | undefined {
  if (typeof v !== 'string' || v.length > 300) return undefined;
  return /^(https?:\/\/|ugrak:\/\/|exp:\/\/)/.test(v) ? v : undefined;
}

type VenueInput = {
  name: string;
  category: string;
  district: string;
  address: string | null;
  description: string | null;
  lat: number;
  lng: number;
  price_level: number;
};

function parseVenue(v: any): VenueInput {
  const venue: VenueInput = {
    name: str(v?.name, 80),
    category: str(v?.category, 30),
    district: str(v?.district, 40),
    address: str(v?.address, 160) || null,
    description: str(v?.description, 300) || null,
    lat: Number(v?.lat),
    lng: Number(v?.lng),
    price_level: Number(v?.price_level),
  };
  if (venue.name.length < 2) throw new HttpError(400, 'Mekan adı en az 2 karakter olmalı.');
  if (!CATEGORIES.includes(venue.category)) throw new HttpError(400, 'Geçerli bir kategori seç.');
  if (venue.district.length < 2) throw new HttpError(400, 'Semt en az 2 karakter olmalı.');
  if (!Number.isFinite(venue.lat) || !Number.isFinite(venue.lng)) throw new HttpError(400, 'Konum (enlem, boylam) gir.');
  if (venue.lat < 40.8 || venue.lat > 41.6 || venue.lng < 27.9 || venue.lng > 29.95) {
    throw new HttpError(400, 'Konum İstanbul sınırları içinde olmalı.');
  }
  if (![1, 2, 3].includes(venue.price_level)) throw new HttpError(400, 'Fiyat seviyesi 1, 2 ya da 3 olmalı.');
  return venue;
}

/**
 * Sahip hesabını bul ya da aç.
 * created=true ise hesap bu istekte açıldı (hata olursa geri silinmeli).
 */
async function ensureOwner(admin: SupabaseClient, adminId: string, email: string, name: string) {
  const { data: existing, error } = await admin.rpc('admin_prepare_owner', {
    p_admin: adminId,
    p_email: email,
    p_name: name,
  });
  if (error) throw new HttpError(400, dbMessage(error, 'Sahip hesabı hazırlanamadı.'));
  if (existing) return { ownerId: existing as string, created: false };

  const { data, error: createError } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    email_confirm: true, // admin işletmeyle görüştü; adresin sahibi şifre linkiyle ayrıca kanıtlanır
    user_metadata: { display_name: name.trim().slice(0, 24) },
  });
  if (createError || !data.user) {
    const msg = createError?.message ?? '';
    if (/already|registered|exists/i.test(msg)) {
      throw new HttpError(409, 'Bu e-postayla zaten bir hesap var ama mekan sahibi hesabı değil.');
    }
    throw new HttpError(400, 'Sahip hesabı açılamadı: ' + (msg || 'bilinmeyen hata'));
  }
  return { ownerId: data.user.id, created: true };
}

async function sendPasswordMail(admin: SupabaseClient, email: string, redirectTo?: string) {
  const { error } = await admin.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  return error ? (/rate|security purposes/i.test(error.message) ? 'Çok sık mail gönderildi, birkaç dakika sonra tekrar dene.' : error.message) : null;
}

async function attach(
  admin: SupabaseClient,
  adminId: string,
  owner: { ownerId: string; created: boolean },
  application: string | null,
  venueId: string | null,
  venue: VenueInput | null,
) {
  const { data, error } = await admin.rpc('admin_attach_venue', {
    p_admin: adminId,
    p_owner: owner.ownerId,
    p_application: application,
    p_venue: venueId,
    p_data: venue ?? {},
  });
  if (error || !data) {
    // Yarım kalmasın: bu istekte açılan hesabı geri sil.
    if (owner.created) await admin.auth.admin.deleteUser(owner.ownerId).catch(() => {});
    throw new HttpError(400, dbMessage(error, 'Mekan açılamadı.'));
  }
  return data as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Sadece POST.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    if (!url) throw new HttpError(500, 'SUPABASE_URL yok.');
    const admin = createClient(url, secretKey(), { auth: { persistSession: false, autoRefreshToken: false } });

    // 1) Çağıran kim? Oturum anahtarını doğrula.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) throw new HttpError(401, 'Oturum bulunamadı, tekrar giriş yap.');
    const { data: who, error: whoError } = await admin.auth.getUser(token);
    if (whoError || !who.user) throw new HttpError(401, 'Oturum geçersiz, tekrar giriş yap.');

    // 2) Admin mi?
    const { data: prof } = await admin.from('profiles').select('role').eq('id', who.user.id).maybeSingle();
    if (prof?.role !== 'admin') throw new HttpError(403, 'Bu işlem sadece admin içindir.');
    const adminId = who.user.id;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new HttpError(400, 'İstek gövdesi boş.');
    const redirectTo = safeRedirect(body.redirectTo);

    // 3) İşlem
    if (body.action === 'approve' || body.action === 'assignOwner') {
      const email = str(body.ownerEmail, 120).toLowerCase();
      const name = str(body.ownerName, 24);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, 'Sahibin e-postasını doğru gir.');
      if (!name) throw new HttpError(400, 'Sahibin adını gir.');

      let application: string | null = null;
      let venueId: string | null = null;
      let venue: VenueInput | null = null;
      if (body.action === 'approve') {
        application = str(body.applicationId, 40);
        if (!application) throw new HttpError(400, 'Başvuru seçilmedi.');
        venue = parseVenue(body.venue);
      } else {
        venueId = str(body.venueId, 40);
        if (!venueId) throw new HttpError(400, 'Mekan seçilmedi.');
      }

      const owner = await ensureOwner(admin, adminId, email, name);
      const newVenue = await attach(admin, adminId, owner, application, venueId, venue);
      // Yeni hesaba şifre belirleme maili. Mevcut sahibin zaten şifresi var.
      const mailError = owner.created ? await sendPasswordMail(admin, email, redirectTo) : null;
      return json({
        ok: true,
        venueId: newVenue,
        newAccount: owner.created,
        mailSent: owner.created && !mailError,
        mailError,
      });
    }

    if (body.action === 'resendInvite') {
      const venueId = str(body.venueId, 40);
      const { data: v } = await admin.from('venues').select('owner_id').eq('id', venueId).maybeSingle();
      if (!v?.owner_id) throw new HttpError(404, 'Bu mekanın sahibi yok.');
      const { data: p } = await admin.from('profiles').select('email').eq('id', v.owner_id).maybeSingle();
      if (!p?.email) throw new HttpError(404, 'Sahip hesabı bulunamadı.');
      const mailError = await sendPasswordMail(admin, p.email, redirectTo);
      if (mailError) throw new HttpError(429, mailError);
      return json({ ok: true, mailSent: true });
    }

    throw new HttpError(400, 'Bilinmeyen işlem.');
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Sunucu hatası. Biraz sonra tekrar dene.' }, 500);
  }
});
