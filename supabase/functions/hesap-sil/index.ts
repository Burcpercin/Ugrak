// =====================================================================
//  UĞRAK — hesap-sil (Supabase Edge Function)
//  KVKK: öğrencinin hesabını ve kişisel verilerini kalıcı olarak siler.
//
//  Silinenler (veritabanında "on delete cascade"): profil, yorumlar,
//  favoriler, kampanya kodları. Geri alınamaz.
//
//  Güvenlik:
//   - Sadece kişinin kendisi, kendi oturumuyla silebilir.
//   - Şifre sunucuda tekrar kontrol edilir (açık unutulmuş bir oturumla
//     başkası hesabı silemesin) ve "SİL" onayı istenir.
//   - Mekan sahibi ve admin hesabı buradan silinemez (mekanlar sahipsiz
//     kalmasın); bunun için ekiple iletişime geçilir.
//
//  Kurulum: Supabase → Edge Functions → Deploy a new function → Via Editor →
//  adı "hesap-sil" → bu dosyanın tamamını yapıştır → Deploy function.
// =====================================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function pickKey(dictVar: string, legacyVar: string): string | null {
  try {
    const keys = JSON.parse(Deno.env.get(dictVar) ?? '{}');
    if (typeof keys.default === 'string' && keys.default) return keys.default;
  } catch {
    // eski projelerde yok
  }
  return Deno.env.get(legacyVar) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Sadece POST.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const secret = pickKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
    const publishable = pickKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
    if (!url || !secret || !publishable) return json({ error: 'Sunucu ayarı eksik.' }, 500);
    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Oturum bulunamadı, tekrar giriş yap.' }, 401);
    const { data: who, error: whoError } = await admin.auth.getUser(token);
    const user = who?.user;
    if (whoError || !user?.email) return json({ error: 'Oturum geçersiz, tekrar giriş yap.' }, 401);

    const body = await req.json().catch(() => null);
    if (body?.confirm !== 'SİL') return json({ error: 'Onay için kutuya SİL yaz.' }, 400);
    if (typeof body.password !== 'string' || !body.password) return json({ error: 'Şifreni gir.' }, 400);

    const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (prof?.role === 'venue_owner' || prof?.role === 'admin') {
      return json({ error: 'Mekan ve admin hesapları uygulamadan silinemez. Bizimle iletişime geç.' }, 409);
    }

    // Şifreyi ayrı, kayıtsız bir istemciyle doğrula.
    const check = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: signed, error: pwError } = await check.auth.signInWithPassword({ email: user.email, password: body.password });
    if (pwError || signed.user?.id !== user.id) {
      return json({ error: /rate|security/i.test(pwError?.message ?? '') ? 'Çok sık deneme yapıldı, biraz bekle.' : 'Şifre hatalı.' }, 403);
    }
    await check.auth.signOut().catch(() => {});

    const { error: delError } = await admin.auth.admin.deleteUser(user.id);
    if (delError) {
      console.error(delError);
      return json({ error: 'Hesap silinemedi. Biraz sonra tekrar dene.' }, 500);
    }
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: 'Sunucu hatası. Biraz sonra tekrar dene.' }, 500);
  }
});
