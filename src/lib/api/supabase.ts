import '../polyfills';
import { AppState, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Api, Profile, Redemption, ReviewItem, Scores, SessionInfo, VenueListItem, VenueStats } from '../types';
import { STATIC_CAMPUSES, checkStudentEmail } from '../universities';
import { AppError } from './errors';

// =====================================================================
// SUPABASE MODU
// .env dosyasında EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_KEY
// tanımlıysa bu katman çalışır. Kurallar (edu kontrolü, yıllık doğrulama,
// tek yorum, kod süresi) veritabanında da uygulanır: supabase/schema.sql
// =====================================================================

function mapAuthError(e: { message?: string } | null): never {
  const msg = e?.message ?? '';
  if (/database error saving new user/i.test(msg) || /UGRAK_DOMAIN/.test(msg)) {
    throw new AppError('DOMAIN', 'Bu adres desteklenen bir İstanbul üniversitesine ait değil.');
  }
  if (/email not confirmed/i.test(msg)) {
    throw new AppError('NOT_CONFIRMED', 'E-posta adresin henüz doğrulanmamış. Gelen kutundaki linke tıkla.');
  }
  if (/invalid login credentials/i.test(msg)) throw new AppError('CREDENTIALS', 'E-posta ya da şifre hatalı.');
  if (/already registered/i.test(msg)) throw new AppError('EXISTS', 'Bu e-posta ile zaten bir hesap var.');
  if (/rate limit|security purposes/i.test(msg)) {
    throw new AppError('RATE', 'Çok sık deneme yapıldı. Biraz bekleyip tekrar dene.');
  }
  if (/token has expired|invalid/i.test(msg)) throw new AppError('OTP', 'Kod hatalı ya da süresi dolmuş.');
  throw new AppError('UNKNOWN', msg || 'Sunucuya ulaşılamadı.');
}

function mapDbError(e: { message?: string } | null): never {
  const msg = e?.message ?? '';
  const m = msg.match(/UGRAK_[A-Z_]+:\s*(.*)$/);
  if (m) throw new AppError('DB', m[1]);
  if (/row-level security/i.test(msg)) {
    throw new AppError('VERIFY', 'Bu işlem için öğrenci doğrulaman güncel olmalı.');
  }
  throw new AppError('DB', msg || 'Veritabanı hatası.');
}

/** Bir linkin hem ?sorgu hem #parça parametrelerini tek nesnede toplar. */
function parseLinkParams(link: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts: string[] = [];
  const q = link.indexOf('?');
  const h = link.indexOf('#');
  if (q >= 0) parts.push(link.slice(q + 1, h > q ? h : undefined));
  if (h >= 0) parts.push(link.slice(h + 1));
  for (const part of parts) {
    for (const pair of part.split('&')) {
      if (!pair) continue;
      const [k, v = ''] = pair.split('=');
      try {
        out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
      } catch {
        out[k] = v;
      }
    }
  }
  return out;
}

// Okunacak sütunlar açıkça yazılır: veritabanı owner_id gibi gizli sütunları
// zaten vermez, select('*') bu yüzden hata döner.
const VENUE_COLS = 'id,name,category,description,district,address,lat,lng,price_level,university_id';
const CAMPAIGN_COLS = 'id,venue_id,title,description,discount_text,starts_at,ends_at,is_active';
const REVIEW_COLS =
  'id,venue_id,is_mine,price,study,portion,vibe,comment,created_at,updated_at,display_name,avatar,university_short';

const num = (v: unknown) => (v == null ? null : Number(v));

function normStats(row: any, venueId: string): VenueStats {
  return {
    venue_id: venueId,
    review_count: row?.review_count ?? 0,
    avg_price: num(row?.avg_price),
    avg_study: num(row?.avg_study),
    avg_portion: num(row?.avg_portion),
    avg_vibe: num(row?.avg_vibe),
    avg_overall: num(row?.avg_overall),
  };
}

export function createSupabaseApi(url: string, key: string): Api {
  const sb: SupabaseClient = createClient(url, key, {
    auth: {
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Web'de doğrulama linkinden dönünce oturumu adres çubuğundan kendisi açar.
      // Telefonda link uygulamayı ugrak:// ile açar; oturumu handleAuthRedirect kurar.
      detectSessionInUrl: Platform.OS === 'web',
    },
  });

  // Telefonda: uygulama öne gelince oturum yenilemeyi başlat, arka plandayken durdur
  // (Supabase'in React Native için önerdiği ayar).
  if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (state) => {
      if (state === 'active') sb.auth.startAutoRefresh();
      else sb.auth.stopAutoRefresh();
    });
  }

  async function requireUser() {
    const { data } = await sb.auth.getSession();
    const user = data.session?.user;
    if (!user) throw new AppError('AUTH', 'Oturum bulunamadı, tekrar giriş yap.');
    return user;
  }

  // Okul mailindeki linkin döneceği adres. Web: sitenin kendisi. Telefon: uygulamanın
  // kendi adresi (ugrak://, Expo Go'da exp://…). Bu adresler Supabase panelinde
  // Authentication → URL Configuration → Redirect URLs listesine eklenmeli.
  const redirectUrl = () =>
    Platform.OS === 'web'
      ? typeof window !== 'undefined'
        ? `${window.location.origin}/`
        : undefined
      : Linking.createURL('/');

  const toSession = (s: any): SessionInfo => (s?.user ? { userId: s.user.id, email: s.user.email ?? '' } : null);

  return {
    mode: 'supabase',

    async getSession() {
      const { data } = await sb.auth.getSession();
      return toSession(data.session);
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_ev, session) => cb(toSession(session)));
      return () => data.subscription.unsubscribe();
    },

    async signUp({ email, password, displayName, kvkkAccepted }) {
      const check = checkStudentEmail(email);
      if (!check.ok) throw new AppError('DOMAIN', check.reason);
      if (!kvkkAccepted) throw new AppError('KVKK', 'Devam etmek için aydınlatma metnini onaylamalısın.');
      if (password.length < 8) throw new AppError('PASSWORD', 'Şifre en az 8 karakter olmalı.');
      const redirect = redirectUrl();
      const { data, error } = await sb.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { display_name: displayName.trim(), kvkk_accepted: 'true' },
          emailRedirectTo: redirect,
        },
      });
      if (error) mapAuthError(error);
      return { needsVerification: !data.session };
    },

    async handleAuthRedirect(link) {
      // Doğrulama linki uygulamayı açtığında gelen adresten oturumu kur.
      // Supabase jetonları adresin # kısmında (ya da ?code= olarak) gönderir.
      const params = parseLinkParams(link);
      if (params.error_description || params.error) {
        throw new AppError(
          'LINK',
          /expired/i.test(params.error_description ?? params.error_code ?? '')
            ? 'Doğrulama linkinin süresi dolmuş. Giriş ekranından yeni link isteyebilirsin.'
            : 'Doğrulama linki geçersiz. Giriş yapmayı dene; e-postan doğrulandıysa girebilirsin.',
        );
      }
      if (params.access_token && params.refresh_token) {
        const { error } = await sb.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (error) mapAuthError(error);
        return true;
      }
      if (params.code) {
        const { error } = await sb.auth.exchangeCodeForSession(params.code);
        if (error) mapAuthError(error);
        return true;
      }
      return false;
    },

    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) mapAuthError(error);
    },

    async signOut() {
      await sb.auth.signOut();
    },

    async resendVerification(email) {
      const { error } = await sb.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
      if (error) mapAuthError(error);
    },

    async getProfile() {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return null;
      const { data, error } = await sb.from('profiles').select('*').eq('id', s.session.user.id).maybeSingle();
      if (error) mapDbError(error);
      return (data as Profile) ?? null;
    },

    async updateProfile(patch) {
      const user = await requireUser();
      const { data, error } = await sb.from('profiles').update(patch).eq('id', user.id).select('*').single();
      if (error) mapDbError(error);
      return data as Profile;
    },

    async requestReverify(email) {
      const user = await requireUser();
      if (email.trim().toLowerCase() !== user.email) {
        throw new AppError('EMAIL', 'Kod sadece hesabındaki edu adresine gönderilebilir.');
      }
      // Mailde hem 6 haneli kod hem de tek dokunuşla yenileme linki olur.
      const { error } = await sb.auth.signInWithOtp({
        email: user.email!,
        options: { shouldCreateUser: false, emailRedirectTo: redirectUrl() },
      });
      if (error) mapAuthError(error);
    },

    async confirmReverify(email, code) {
      const { error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
      if (error) mapAuthError(error);
      const { error: rpcError } = await sb.rpc('refresh_verification');
      if (rpcError) mapDbError(rpcError);
    },

    async tryRefreshVerification() {
      const { error } = await sb.rpc('refresh_verification');
      return !error;
    },

    async listCampuses() {
      const { data, error } = await sb
        .from('campuses')
        .select('id,university_id,name,district,lat,lng')
        .eq('is_active', true)
        .order('university_id');
      if (error || !data?.length) return STATIC_CAMPUSES;
      return data as any;
    },

    async listVenues() {
      const nowIso = new Date().toISOString();
      const [v, st, c] = await Promise.all([
        sb.from('venues').select(VENUE_COLS).eq('is_active', true),
        sb.from('venue_stats').select('*'),
        sb.from('campaigns').select(CAMPAIGN_COLS).eq('is_active', true).lte('starts_at', nowIso).gt('ends_at', nowIso),
      ]);
      if (v.error) mapDbError(v.error);
      if (st.error) mapDbError(st.error);
      if (c.error) mapDbError(c.error);
      return (v.data ?? []).map(
        (venue: any): VenueListItem => ({
          ...venue,
          stats: normStats(st.data?.find((x: any) => x.venue_id === venue.id), venue.id),
          campaigns: (c.data ?? []).filter((x: any) => x.venue_id === venue.id),
        }),
      );
    },

    async getVenue(id) {
      const nowIso = new Date().toISOString();
      const [v, st, c, r] = await Promise.all([
        sb.from('venues').select(VENUE_COLS).eq('id', id).maybeSingle(),
        sb.from('venue_stats').select('*').eq('venue_id', id).maybeSingle(),
        sb.from('campaigns').select(CAMPAIGN_COLS).eq('venue_id', id).eq('is_active', true).lte('starts_at', nowIso).gt('ends_at', nowIso),
        sb.from('review_feed').select(REVIEW_COLS).eq('venue_id', id).order('updated_at', { ascending: false }),
      ]);
      if (v.error) mapDbError(v.error);
      if (!v.data) return null;
      return {
        venue: v.data as any,
        stats: normStats(st.data, id),
        campaigns: (c.data ?? []) as any,
        reviews: (r.data ?? []) as ReviewItem[],
      };
    },

    async saveReview(venueId, scores: Scores, comment) {
      const user = await requireUser();
      const text = comment.trim().slice(0, 500) || null;
      // Önce kendi yorumunu güncellemeyi dene; yoksa yeni ekle. (upsert kullanılmıyor:
      // veritabanı user_id ve venue_id'nin sonradan değiştirilmesine izin vermiyor.)
      const upd = await sb
        .from('reviews')
        .update({ ...scores, comment: text })
        .eq('user_id', user.id)
        .eq('venue_id', venueId)
        .select('id');
      if (upd.error) mapDbError(upd.error);
      if ((upd.data ?? []).length > 0) return;
      const { error } = await sb.from('reviews').insert({ user_id: user.id, venue_id: venueId, ...scores, comment: text });
      if (error) mapDbError(error);
    },

    async deleteReview(venueId) {
      const user = await requireUser();
      const { error } = await sb.from('reviews').delete().eq('user_id', user.id).eq('venue_id', venueId);
      if (error) mapDbError(error);
    },

    async myReviews() {
      await requireUser();
      // my_reviews görünümü sadece giriş yapan kişinin yorumlarını döndürür.
      const { data, error } = await sb.from('my_reviews').select('*').order('updated_at', { ascending: false });
      if (error) mapDbError(error);
      return (data ?? []).map((r: any) => ({
        id: r.id,
        venue_id: r.venue_id,
        is_mine: true,
        price: r.price,
        study: r.study,
        portion: r.portion,
        vibe: r.vibe,
        comment: r.comment,
        created_at: r.created_at,
        updated_at: r.updated_at,
        display_name: '',
        avatar: null,
        university_short: null,
        venue_name: r.venue_name ?? '—',
      }));
    },

    async listFavorites() {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return [];
      const { data, error } = await sb.from('favorites').select('venue_id');
      if (error) mapDbError(error);
      return (data ?? []).map((f: any) => f.venue_id);
    },

    async toggleFavorite(venueId) {
      const user = await requireUser();
      const { data } = await sb.from('favorites').select('venue_id').eq('venue_id', venueId).maybeSingle();
      if (data) {
        const { error } = await sb.from('favorites').delete().eq('user_id', user.id).eq('venue_id', venueId);
        if (error) mapDbError(error);
        return false;
      }
      const { error } = await sb.from('favorites').insert({ user_id: user.id, venue_id: venueId });
      if (error) mapDbError(error);
      return true;
    },

    async createRedemption(campaignId) {
      const { data, error } = await sb.rpc('create_redemption', { p_campaign: campaignId });
      if (error) mapDbError(error);
      return data as Redemption;
    },
  };
}
