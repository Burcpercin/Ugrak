import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Api, Profile, Redemption, ReviewItem, Scores, SessionInfo, VenueListItem, VenueStats } from '../types';
import { checkStudentEmail } from '../universities';
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
      detectSessionInUrl: Platform.OS === 'web', // doğrulama linkinden dönünce oturumu aç
    },
  });

  async function requireUser() {
    const { data } = await sb.auth.getSession();
    const user = data.session?.user;
    if (!user) throw new AppError('AUTH', 'Oturum bulunamadı, tekrar giriş yap.');
    return user;
  }

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
      const redirect =
        Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
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
      const { error } = await sb.auth.signInWithOtp({ email: user.email!, options: { shouldCreateUser: false } });
      if (error) mapAuthError(error);
    },

    async confirmReverify(email, code) {
      const { error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
      if (error) mapAuthError(error);
      const { error: rpcError } = await sb.rpc('refresh_verification');
      if (rpcError) mapDbError(rpcError);
    },

    async listVenues() {
      const nowIso = new Date().toISOString();
      const [v, st, c] = await Promise.all([
        sb.from('venues').select('*').eq('is_active', true),
        sb.from('venue_stats').select('*'),
        sb.from('campaigns').select('*').eq('is_active', true).lte('starts_at', nowIso).gt('ends_at', nowIso),
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
        sb.from('venues').select('*').eq('id', id).maybeSingle(),
        sb.from('venue_stats').select('*').eq('venue_id', id).maybeSingle(),
        sb.from('campaigns').select('*').eq('venue_id', id).eq('is_active', true).lte('starts_at', nowIso).gt('ends_at', nowIso),
        sb.from('review_feed').select('*').eq('venue_id', id).order('updated_at', { ascending: false }),
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
      const { error } = await sb
        .from('reviews')
        .upsert(
          { user_id: user.id, venue_id: venueId, ...scores, comment: comment.trim().slice(0, 500) || null },
          { onConflict: 'user_id,venue_id' },
        );
      if (error) mapDbError(error);
    },

    async deleteReview(venueId) {
      const user = await requireUser();
      const { error } = await sb.from('reviews').delete().eq('user_id', user.id).eq('venue_id', venueId);
      if (error) mapDbError(error);
    },

    async myReviews() {
      const user = await requireUser();
      const { data, error } = await sb.from('review_feed').select('*').eq('user_id', user.id);
      if (error) mapDbError(error);
      const ids = (data ?? []).map((r: any) => r.venue_id);
      const names = ids.length ? (await sb.from('venues').select('id,name').in('id', ids)).data ?? [] : [];
      return (data ?? []).map((r: any) => ({
        ...r,
        venue_name: names.find((n: any) => n.id === r.venue_id)?.name ?? '—',
      }));
    },

    async listFavorites() {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return [];
      const { data } = await sb.from('favorites').select('venue_id');
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
