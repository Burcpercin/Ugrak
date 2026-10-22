import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Api,
  AvatarConfig,
  Profile,
  Redemption,
  ReviewItem,
  Scores,
  SessionInfo,
  SignUpInput,
  VenueStats,
} from '../types';
import { checkStudentEmail, universityById } from '../universities';
import { DEMO_AUTHORS, SEED_REVIEWS, SEED_VENUES, seedCampaigns } from '../seed';
import { AppError } from './errors';

// =====================================================================
// DEMO MODU
// Supabase anahtarı girilmediğinde çalışır. Veriler cihazda (web'de
// localStorage) tutulur. Doğrulama mailleri gerçekten gönderilmez;
// uygulama içindeki "Demo gelen kutusu" kartında görünür.
// Akış ve kurallar Supabase modundakiyle birebir aynıdır.
// =====================================================================

const KEY = 'ugrak-demo-v1';
const YEAR = 365 * 24 * 3600 * 1000;

type DemoUser = {
  id: string;
  email: string;
  password: string; // sadece demo içindir, gerçek sistemde şifreyi Supabase Auth saklar
  display_name: string;
  university_id: number;
  avatar: AvatarConfig | null;
  verified_at: string | null;
  email_confirmed: boolean;
  kvkk_accepted_at: string | null;
};

type DemoReview = Scores & {
  id: string;
  user_id: string;
  venue_id: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type DemoMail = {
  id: string;
  to: string;
  kind: 'signup' | 'otp';
  subject: string;
  code?: string;
  created_at: string;
  opened?: boolean;
};

type Store = {
  v: 1;
  users: DemoUser[];
  sessionUserId: string | null;
  reviews: DemoReview[];
  favorites: { user_id: string; venue_id: string }[];
  redemptions: (Redemption & { user_id: string })[];
  outbox: DemoMail[];
};

const uid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

function freshStore(): Store {
  const now = Date.now();
  return {
    v: 1,
    users: [],
    sessionUserId: null,
    reviews: SEED_REVIEWS.map((r) => {
      const t = new Date(now - r.daysAgo * 24 * 3600 * 1000).toISOString();
      return {
        id: uid(),
        user_id: r.user_id,
        venue_id: r.venue_id,
        price: r.price,
        study: r.study,
        portion: r.portion,
        vibe: r.vibe,
        comment: r.comment,
        created_at: t,
        updated_at: t,
      };
    }),
    favorites: [],
    redemptions: [],
    outbox: [],
  };
}

let cache: Store | null = null;
const listeners = new Set<(s: SessionInfo) => void>();
const mailListeners = new Set<() => void>();

async function load(): Promise<Store> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Store) : freshStore();
  } catch {
    cache = freshStore();
  }
  return cache!;
}

async function save(s: Store) {
  cache = s;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // depolama kapalıysa (gizli sekme vb.) bellekte devam et
  }
}

function sessionOf(s: Store): SessionInfo {
  const u = s.users.find((x) => x.id === s.sessionUserId);
  return u ? { userId: u.id, email: u.email } : null;
}

function emit(s: Store) {
  const sess = sessionOf(s);
  listeners.forEach((cb) => cb(sess));
}

function emitMail() {
  mailListeners.forEach((cb) => cb());
}

async function currentUser(): Promise<{ s: Store; u: DemoUser }> {
  const s = await load();
  const u = s.users.find((x) => x.id === s.sessionUserId);
  if (!u) throw new AppError('AUTH', 'Oturum bulunamadı, tekrar giriş yap.');
  return { s, u };
}

function isVerified(u: DemoUser) {
  return !!u.verified_at && Date.now() - new Date(u.verified_at).getTime() < YEAR;
}

function toProfile(u: DemoUser): Profile {
  return {
    id: u.id,
    email: u.email,
    display_name: u.display_name,
    university_id: u.university_id,
    avatar: u.avatar,
    role: 'student',
    verified_at: u.verified_at,
    kvkk_accepted_at: u.kvkk_accepted_at,
  };
}

function statsFor(reviews: DemoReview[], venueId: string): VenueStats {
  const rs = reviews.filter((r) => r.venue_id === venueId);
  const avg = (k: keyof Scores) =>
    rs.length ? Math.round((rs.reduce((a, r) => a + r[k], 0) / rs.length) * 10) / 10 : null;
  const overall = rs.length
    ? Math.round((rs.reduce((a, r) => a + (r.price + r.study + r.portion + r.vibe) / 4, 0) / rs.length) * 10) / 10
    : null;
  return {
    venue_id: venueId,
    review_count: rs.length,
    avg_price: avg('price'),
    avg_study: avg('study'),
    avg_portion: avg('portion'),
    avg_vibe: avg('vibe'),
    avg_overall: overall,
  };
}

function author(s: Store, userId: string) {
  const u = s.users.find((x) => x.id === userId);
  if (u) return { display_name: u.display_name, avatar: u.avatar, university_id: u.university_id };
  const d = DEMO_AUTHORS.find((x) => x.id === userId);
  return d
    ? { display_name: d.display_name, avatar: d.avatar, university_id: d.university_id }
    : { display_name: 'Uğrakçı', avatar: null, university_id: null };
}

function toReviewItem(s: Store, r: DemoReview): ReviewItem {
  const a = author(s, r.user_id);
  return {
    ...r,
    display_name: a.display_name,
    avatar: a.avatar,
    university_short: universityById(a.university_id)?.short_name ?? null,
  };
}

function activeCampaigns() {
  const now = Date.now();
  return seedCampaigns().filter(
    (c) => c.is_active && new Date(c.starts_at).getTime() <= now && new Date(c.ends_at).getTime() > now,
  );
}

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

function sendMail(s: Store, mail: Omit<DemoMail, 'id' | 'created_at'>) {
  s.outbox.unshift({ ...mail, id: uid(), created_at: new Date().toISOString() });
  s.outbox = s.outbox.slice(0, 20);
}

function randomCode(len: number, alphabet = '0123456789') {
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export const demoApi: Api = {
  mode: 'demo',

  async getSession() {
    return sessionOf(await load());
  },

  onAuthChange(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  async signUp({ email, password, displayName, kvkkAccepted }: SignUpInput) {
    await delay();
    const check = checkStudentEmail(email);
    if (!check.ok) throw new AppError('DOMAIN', check.reason);
    if (!kvkkAccepted) throw new AppError('KVKK', 'Devam etmek için aydınlatma metnini onaylamalısın.');
    if (password.length < 8) throw new AppError('PASSWORD', 'Şifre en az 8 karakter olmalı.');
    const s = await load();
    const mail = email.trim().toLowerCase();
    if (s.users.some((u) => u.email === mail)) {
      throw new AppError('EXISTS', 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.');
    }
    s.users.push({
      id: uid(),
      email: mail,
      password,
      display_name: displayName.trim() || 'Uğrakçı',
      university_id: check.university.id,
      avatar: null,
      verified_at: null,
      email_confirmed: false,
      kvkk_accepted_at: new Date().toISOString(),
    });
    sendMail(s, { to: mail, kind: 'signup', subject: 'Uğrak — Öğrenci adresini doğrula' });
    await save(s);
    emitMail();
    return { needsVerification: true };
  },

  async signIn(email, password) {
    await delay();
    const s = await load();
    const u = s.users.find((x) => x.email === email.trim().toLowerCase());
    if (!u || u.password !== password) throw new AppError('CREDENTIALS', 'E-posta ya da şifre hatalı.');
    if (!u.email_confirmed) {
      throw new AppError('NOT_CONFIRMED', 'E-posta adresin henüz doğrulanmamış. Gelen kutundaki linke tıkla.');
    }
    s.sessionUserId = u.id;
    await save(s);
    emit(s);
  },

  async signOut() {
    const s = await load();
    s.sessionUserId = null;
    await save(s);
    emit(s);
  },

  async resendVerification(email) {
    await delay();
    const s = await load();
    const mail = email.trim().toLowerCase();
    const u = s.users.find((x) => x.email === mail);
    if (u && !u.email_confirmed) {
      sendMail(s, { to: mail, kind: 'signup', subject: 'Uğrak — Öğrenci adresini doğrula' });
      await save(s);
      emitMail();
    }
  },

  async getProfile() {
    const s = await load();
    const u = s.users.find((x) => x.id === s.sessionUserId);
    return u ? toProfile(u) : null;
  },

  async updateProfile(patch) {
    const { s, u } = await currentUser();
    if (patch.display_name !== undefined) u.display_name = patch.display_name.trim().slice(0, 24) || u.display_name;
    if (patch.avatar !== undefined) u.avatar = patch.avatar;
    await save(s);
    return toProfile(u);
  },

  async requestReverify(email) {
    await delay();
    const { s, u } = await currentUser();
    if (email.trim().toLowerCase() !== u.email) throw new AppError('EMAIL', 'Kod sadece hesabındaki edu adresine gönderilebilir.');
    sendMail(s, { to: u.email, kind: 'otp', subject: 'Uğrak — Yıllık doğrulama kodun', code: randomCode(6) });
    await save(s);
    emitMail();
  },

  async confirmReverify(_email, code) {
    await delay();
    const { s, u } = await currentUser();
    const mail = s.outbox.find(
      (m) => m.to === u.email && m.kind === 'otp' && Date.now() - new Date(m.created_at).getTime() < 15 * 60 * 1000,
    );
    if (!mail || mail.code !== code.trim()) throw new AppError('OTP', 'Kod hatalı ya da süresi dolmuş.');
    u.verified_at = new Date().toISOString();
    mail.opened = true;
    await save(s);
    emitMail();
  },

  async listVenues() {
    const s = await load();
    const camps = activeCampaigns();
    return SEED_VENUES.map((v) => ({
      ...v,
      stats: statsFor(s.reviews, v.id),
      campaigns: camps.filter((c) => c.venue_id === v.id),
    }));
  },

  async getVenue(id) {
    const s = await load();
    const venue = SEED_VENUES.find((v) => v.id === id);
    if (!venue) return null;
    return {
      venue,
      stats: statsFor(s.reviews, id),
      campaigns: activeCampaigns().filter((c) => c.venue_id === id),
      reviews: s.reviews
        .filter((r) => r.venue_id === id)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((r) => toReviewItem(s, r)),
    };
  },

  async saveReview(venueId, scores, comment) {
    await delay();
    const { s, u } = await currentUser();
    if (!isVerified(u)) throw new AppError('VERIFY', 'Yorum yapmak için öğrenci doğrulaman güncel olmalı.');
    for (const v of Object.values(scores)) {
      if (!(v >= 1 && v <= 5)) throw new AppError('SCORE', 'Dört kriterin hepsine 1-5 arası puan ver.');
    }
    const text = comment.trim().slice(0, 500) || null;
    const now = new Date().toISOString();
    const existing = s.reviews.find((r) => r.user_id === u.id && r.venue_id === venueId);
    if (existing) {
      Object.assign(existing, scores, { comment: text, updated_at: now });
    } else {
      s.reviews.push({ id: uid(), user_id: u.id, venue_id: venueId, ...scores, comment: text, created_at: now, updated_at: now });
    }
    await save(s);
  },

  async deleteReview(venueId) {
    const { s, u } = await currentUser();
    s.reviews = s.reviews.filter((r) => !(r.user_id === u.id && r.venue_id === venueId));
    await save(s);
  },

  async myReviews() {
    const { s, u } = await currentUser();
    return s.reviews
      .filter((r) => r.user_id === u.id)
      .map((r) => ({
        ...toReviewItem(s, r),
        venue_name: SEED_VENUES.find((v) => v.id === r.venue_id)?.name ?? '—',
      }));
  },

  async listFavorites() {
    const s = await load();
    return s.favorites.filter((f) => f.user_id === s.sessionUserId).map((f) => f.venue_id);
  },

  async toggleFavorite(venueId) {
    const { s, u } = await currentUser();
    const has = s.favorites.some((f) => f.user_id === u.id && f.venue_id === venueId);
    s.favorites = has
      ? s.favorites.filter((f) => !(f.user_id === u.id && f.venue_id === venueId))
      : [...s.favorites, { user_id: u.id, venue_id: venueId }];
    await save(s);
    return !has;
  },

  async createRedemption(campaignId) {
    await delay();
    const { s, u } = await currentUser();
    if (!isVerified(u)) throw new AppError('VERIFY', 'Kampanya kodu için öğrenci doğrulaman güncel olmalı.');
    if (!activeCampaigns().some((c) => c.id === campaignId)) throw new AppError('CAMPAIGN', 'Kampanya aktif değil.');
    const existing = s.redemptions.find(
      (r) => r.user_id === u.id && r.campaign_id === campaignId && !r.used_at && new Date(r.expires_at).getTime() > Date.now(),
    );
    if (existing) return existing;
    const red = {
      id: uid(),
      user_id: u.id,
      campaign_id: campaignId,
      code: randomCode(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      used_at: null,
    };
    s.redemptions.push(red);
    await save(s);
    return red;
  },
};

// ---------------------------------------------------------------------
// Sadece demo modunda kullanılan yardımcılar (sunumda akışı göstermek için)
// ---------------------------------------------------------------------

export const demoTools = {
  async inbox(email?: string) {
    const s = await load();
    const mail = email?.trim().toLowerCase();
    return mail ? s.outbox.filter((m) => m.to === mail) : s.outbox;
  },

  onInboxChange(cb: () => void) {
    mailListeners.add(cb);
    return () => mailListeners.delete(cb);
  },

  /** Doğrulama mailindeki linke tıklamayı taklit eder. */
  async openSignupLink(mailId: string) {
    const s = await load();
    const m = s.outbox.find((x) => x.id === mailId);
    if (!m) return;
    const u = s.users.find((x) => x.email === m.to);
    if (u) {
      u.email_confirmed = true;
      u.verified_at = new Date().toISOString();
      s.sessionUserId = u.id; // Supabase'de de link oturumu açar
    }
    m.opened = true;
    await save(s);
    emitMail();
    emit(s);
  },

  /** Sunumda yıllık yeniden doğrulamayı göstermek için doğrulamayı 1 yıl geriye atar. */
  async expireVerification() {
    const { s, u } = await currentUser();
    u.verified_at = new Date(Date.now() - YEAR - 24 * 3600 * 1000).toISOString();
    await save(s);
  },

  async reset() {
    const s = freshStore();
    await save(s);
    emit(s);
    emitMail();
  },
};
