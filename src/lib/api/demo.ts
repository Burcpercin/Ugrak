import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AdminCampus,
  Api,
  Application,
  AvatarConfig,
  Campaign,
  InviteResult,
  OwnerVenue,
  Profile,
  Redemption,
  RedeemResult,
  ReviewItem,
  Scores,
  SessionInfo,
  SignUpInput,
  VenueStats,
} from '../types';
import {
  MAX_CAMPAIGN_DAYS,
  MAX_LIVE_CAMPAIGNS,
  REDEEM_FAIL_LIMIT,
  inIstanbul,
  normalizeCode,
  validateCampaign,
  validateVenue,
} from '../rules';
import { STATIC_CAMPUSES, checkStudentEmail, universityById } from '../universities';
import { DEMO_AUTHORS, SEED_REVIEWS, SEED_VENUES, seedCampaigns } from '../seed';
import { AppError } from './errors';

// =====================================================================
// DEMO MODU
// Supabase anahtarı girilmediğinde çalışır. Veriler cihazda (web'de
// localStorage) tutulur. Mailler gerçekten gönderilmez; uygulama içindeki
// "Demo gelen kutusu" kartında görünür.
// Akış ve kurallar Supabase modundakiyle aynıdır (bkz. lib/rules.ts ve
// supabase/*.sql). Sunum için hazır hesaplar:
//   Mekan sahibi: mekan@tepecay.com / ugrak1234 (Tepe Çay Ocağı)
//   Admin:        admin@istanbularel.edu.tr / ugrak1234
// =====================================================================

const KEY = 'ugrak-demo-v1';
const YEAR = 365 * 24 * 3600 * 1000;
const DAY = 24 * 3600 * 1000;

export const DEMO_ACCOUNTS = {
  owner: { email: 'mekan@tepecay.com', password: 'ugrak1234' },
  admin: { email: 'admin@istanbularel.edu.tr', password: 'ugrak1234' },
};

type Role = Profile['role'];

type DemoUser = {
  id: string;
  email: string;
  password: string; // sadece demo içindir; gerçek sistemde şifreyi Supabase Auth saklar. '' = henüz belirlenmedi
  display_name: string;
  university_id: number | null;
  avatar: AvatarConfig | null;
  role: Role;
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
  hidden_at?: string | null;
};

type DemoVenue = OwnerVenue & { owner_id: string | null };
type DemoCampaign = Campaign & { created_at: string };

export type DemoMail = {
  id: string;
  to: string;
  kind: 'signup' | 'otp' | 'reset';
  subject: string;
  code?: string;
  created_at: string;
  opened?: boolean;
};

type Store = {
  v: 2;
  users: DemoUser[];
  sessionUserId: string | null;
  reviews: DemoReview[];
  favorites: { user_id: string; venue_id: string }[];
  redemptions: (Redemption & { user_id: string; created_at?: string })[];
  outbox: DemoMail[];
  venues: DemoVenue[];
  campaigns: DemoCampaign[];
  applications: Application[];
  attempts: { owner_id: string; at: number; ok: boolean }[];
  campuses: AdminCampus[];
};

const uid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

const iso = (ms = Date.now()) => new Date(ms).toISOString();

function seedAccounts(): DemoUser[] {
  return [
    {
      id: 'demo-owner-1',
      email: DEMO_ACCOUNTS.owner.email,
      password: DEMO_ACCOUNTS.owner.password,
      display_name: 'Tepe Çay',
      university_id: null,
      avatar: null,
      role: 'venue_owner',
      verified_at: null,
      email_confirmed: true,
      kvkk_accepted_at: null,
    },
    {
      id: 'demo-admin-1',
      email: DEMO_ACCOUNTS.admin.email,
      password: DEMO_ACCOUNTS.admin.password,
      display_name: 'Admin',
      university_id: 1,
      avatar: { skin: 1, hairStyle: 'kisa', hairColor: 0, shirt: 2, glasses: true },
      role: 'admin',
      verified_at: iso(),
      email_confirmed: true,
      kvkk_accepted_at: iso(),
    },
  ];
}

function seedApplications(): Application[] {
  const now = Date.now();
  const base = { admin_note: null, venue_id: null, decided_at: null };
  return [
    { id: uid(), venue_name: 'Kampüs Kitap Kafe', contact_name: 'Selin Aydın', phone: '05321234567', email: 'selin@kitapkafe.com', district: 'Büyükçekmece', note: 'Arel Tepekent’e 5 dakika, öğrencilere %15 indirim düşünüyoruz.', status: 'beklemede', created_at: iso(now - 2 * 3600 * 1000), ...base },
    { id: uid(), venue_name: 'Cevizlibağ Pide Salonu', contact_name: 'Murat Kaya', phone: '05339876543', email: 'murat@pidesalonu.com', district: 'Zeytinburnu', note: null, status: 'gorusuldu', created_at: iso(now - 2 * DAY), ...base, admin_note: 'Telefonla görüşüldü, menü fotoğraflarını bekliyoruz.' },
    { id: uid(), venue_name: 'Gece Kahvesi', contact_name: 'Ali Demir', phone: '05551112233', email: 'ali@gecekahvesi.com', district: 'Beşiktaş', note: '24 saat açığız.', status: 'beklemede', created_at: iso(now - 5 * DAY), ...base },
  ];
}

function seedStoreParts(): Pick<Store, 'venues' | 'campaigns' | 'applications' | 'attempts' | 'campuses'> {
  return {
    venues: SEED_VENUES.map((v) => ({
      ...v,
      is_active: true,
      owner_id: v.id === '00000000-0000-4000-8000-000000000101' ? 'demo-owner-1' : null,
    })),
    campaigns: seedCampaigns().map((c) => ({ ...c, created_at: c.starts_at })),
    applications: seedApplications(),
    attempts: [],
    campuses: STATIC_CAMPUSES.map((c) => ({ ...c, is_active: true })),
  };
}

function freshStore(): Store {
  const now = Date.now();
  return {
    v: 2,
    users: seedAccounts(),
    sessionUserId: null,
    reviews: SEED_REVIEWS.map((r) => {
      const t = iso(now - r.daysAgo * DAY);
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
    ...seedStoreParts(),
  };
}

/** Eski (Faz 1) demo verisini kaybetmeden yeni yapıya taşı. */
function migrate(raw: any): Store {
  if (raw?.v === 2) return raw as Store;
  const fresh = freshStore();
  if (!raw || typeof raw !== 'object') return fresh;
  const users: DemoUser[] = (raw.users ?? []).map((u: any) => ({ role: 'student', ...u }));
  for (const acc of seedAccounts()) if (!users.some((u) => u.email === acc.email)) users.push(acc);
  return {
    ...fresh,
    users,
    sessionUserId: raw.sessionUserId ?? null,
    reviews: raw.reviews ?? fresh.reviews,
    favorites: raw.favorites ?? [],
    redemptions: raw.redemptions ?? [],
    outbox: raw.outbox ?? [],
  };
}

let cache: Store | null = null;
const listeners = new Set<(s: SessionInfo, event?: string) => void>();
const mailListeners = new Set<() => void>();

async function load(): Promise<Store> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = migrate(raw ? JSON.parse(raw) : null);
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

function emit(s: Store, event?: string) {
  const sess = sessionOf(s);
  listeners.forEach((cb) => cb(sess, event));
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

async function requireRole(role: Role) {
  const ctx = await currentUser();
  if (ctx.u.role !== role) throw new AppError('FORBIDDEN', 'Bu işlem için yetkin yok.');
  return ctx;
}

/** Mekan sahibi öğrenci sayılmaz (veritabanındaki is_verified ile aynı). */
function isVerified(u: DemoUser) {
  return u.role !== 'venue_owner' && !!u.verified_at && Date.now() - new Date(u.verified_at).getTime() < YEAR;
}

function toProfile(u: DemoUser): Profile {
  return {
    id: u.id,
    email: u.email,
    display_name: u.display_name,
    university_id: u.university_id,
    avatar: u.avatar,
    role: u.role,
    verified_at: u.verified_at,
    kvkk_accepted_at: u.kvkk_accepted_at,
  };
}

const visible = (r: DemoReview) => !r.hidden_at;

function statsFor(reviews: DemoReview[], venueId: string): VenueStats {
  const rs = reviews.filter((r) => r.venue_id === venueId && visible(r));
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
  // Gerçek sistemdeki gibi: yorum yazarının kimliği ekrana gönderilmez,
  // sadece "bu benim yorumum mu" bilgisi gider.
  const { user_id, hidden_at: _h, ...rest } = r;
  return {
    ...rest,
    is_mine: !!s.sessionUserId && user_id === s.sessionUserId,
    display_name: a.display_name,
    avatar: a.avatar,
    university_short: universityById(a.university_id)?.short_name ?? null,
  };
}

const publicVenue = ({ owner_id: _o, is_active: _a, ...v }: DemoVenue) => v;

function liveCampaigns(s: Store) {
  const now = Date.now();
  const open = new Set(s.venues.filter((v) => v.is_active).map((v) => v.id));
  return s.campaigns.filter(
    (c) =>
      c.is_active && open.has(c.venue_id) && new Date(c.starts_at).getTime() <= now && new Date(c.ends_at).getTime() > now,
  );
}

const publicCampaign = ({ created_at: _c, ...c }: DemoCampaign): Campaign => c;

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));

function sendMail(s: Store, mail: Omit<DemoMail, 'id' | 'created_at'>) {
  s.outbox.unshift({ ...mail, id: uid(), created_at: iso() });
  s.outbox = s.outbox.slice(0, 30);
}

function randomCode(len: number, alphabet = '0123456789') {
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function ownedVenue(s: Store, u: DemoUser, venueId: string) {
  const v = s.venues.find((x) => x.id === venueId);
  if (!v || v.owner_id !== u.id) throw new AppError('FORBIDDEN', 'Bu mekan senin hesabına bağlı değil.');
  return v;
}

function countLive(s: Store, venueId: string, exceptId?: string) {
  const now = Date.now();
  return s.campaigns.filter(
    (c) => c.venue_id === venueId && c.is_active && new Date(c.ends_at).getTime() > now && c.id !== exceptId,
  ).length;
}

/** Sahip hesabını bul ya da aç (Edge Function admin-mekan ile aynı mantık). */
function ensureOwner(s: Store, email: string, name: string): { owner: DemoUser; created: boolean } {
  const mail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new AppError('OWNER', 'Sahibin e-postasını doğru gir.');
  const display = name.trim().slice(0, 24);
  if (!display) throw new AppError('OWNER', 'Sahibin adını gir.');
  const existing = s.users.find((u) => u.email === mail);
  if (existing) {
    if (existing.role === 'venue_owner') return { owner: existing, created: false };
    throw new AppError('OWNER', 'Bu e-posta bir öğrenci ya da admin hesabına ait. Mekan için işletme e-postası kullanılmalı.');
  }
  const owner: DemoUser = {
    id: uid(),
    email: mail,
    password: '',
    display_name: display,
    university_id: null,
    avatar: null,
    role: 'venue_owner',
    verified_at: null,
    email_confirmed: true,
    kvkk_accepted_at: null,
  };
  s.users.push(owner);
  return { owner, created: true };
}

function sendPasswordMail(s: Store, email: string, first: boolean) {
  sendMail(s, {
    to: email,
    kind: 'reset',
    subject: first ? 'Uğrak mekan hesabın hazır — şifreni belirle' : 'Uğrak şifreni belirle',
  });
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
      display_name: displayName.trim().slice(0, 24) || 'Uğrakçı',
      university_id: check.university.id,
      avatar: null,
      role: 'student',
      verified_at: null,
      email_confirmed: false,
      kvkk_accepted_at: iso(),
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
    if (!u || !u.password || u.password !== password) throw new AppError('CREDENTIALS', 'E-posta ya da şifre hatalı.');
    if (!u.email_confirmed) {
      throw new AppError('NOT_CONFIRMED', 'E-posta adresin henüz doğrulanmamış. Gelen kutundaki linke tıkla.');
    }
    s.sessionUserId = u.id;
    await save(s);
    emit(s, 'SIGNED_IN');
  },

  async signOut() {
    const s = await load();
    s.sessionUserId = null;
    await save(s);
    emit(s, 'SIGNED_OUT');
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

  async handleAuthRedirect() {
    // Demo modunda mail gerçekten gitmez; linkler uygulama içindeki demo gelen kutusunda.
    return false;
  },

  async requestPasswordReset(email) {
    await delay();
    const mail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) throw new AppError('EMAIL', 'Geçerli bir e-posta adresi gir.');
    const s = await load();
    // Gerçek sistemdeki gibi: adres kayıtlı değilse de aynı yanıt (hesap avcılığına karşı).
    if (s.users.some((u) => u.email === mail)) {
      sendPasswordMail(s, mail, false);
      await save(s);
      emitMail();
    }
  },

  async updatePassword(password) {
    await delay();
    if (password.length < 8) throw new AppError('PASSWORD', 'Şifre en az 8 karakter olmalı.');
    const { s, u } = await currentUser();
    if (u.password && u.password === password) throw new AppError('PASSWORD', 'Yeni şifre eskisiyle aynı olamaz.');
    u.password = password;
    await save(s);
  },

  async deleteAccount(password) {
    await delay();
    const { s, u } = await currentUser();
    if (u.role !== 'student') throw new AppError('FORBIDDEN', 'Mekan ve admin hesapları uygulamadan silinemez. Bizimle iletişime geç.');
    if (u.password !== password) throw new AppError('PASSWORD', 'Şifre hatalı.');
    s.users = s.users.filter((x) => x.id !== u.id);
    s.reviews = s.reviews.filter((r) => r.user_id !== u.id);
    s.favorites = s.favorites.filter((f) => f.user_id !== u.id);
    s.redemptions = s.redemptions.filter((r) => r.user_id !== u.id);
    s.outbox = s.outbox.filter((m) => m.to !== u.email);
    s.sessionUserId = null;
    await save(s);
    emit(s, 'SIGNED_OUT');
  },

  async getProfile() {
    const s = await load();
    const u = s.users.find((x) => x.id === s.sessionUserId);
    return u ? toProfile(u) : null;
  },

  async updateProfile(patch) {
    const { s, u } = await currentUser();
    if (patch.display_name !== undefined) {
      const name = patch.display_name.trim();
      if (name.length < 1 || name.length > 24) throw new AppError('NAME', 'Takma ad 1-24 karakter olmalı.');
      u.display_name = name;
    }
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
    if (u.role === 'venue_owner') throw new AppError('FORBIDDEN', 'Mekan hesabı öğrenci doğrulaması yapamaz.');
    u.verified_at = iso();
    mail.opened = true;
    await save(s);
    emitMail();
  },

  async tryRefreshVerification() {
    // Demoda link yerine kod kullanılıyor (sahte gelen kutusu).
    return false;
  },

  async listCampuses() {
    const s = await load();
    return s.campuses.filter((c) => c.is_active).map(({ is_active: _a, ...c }) => c);
  },

  async listVenues() {
    const s = await load();
    const camps = liveCampaigns(s);
    return s.venues
      .filter((v) => v.is_active)
      .map((v) => ({
        ...publicVenue(v),
        stats: statsFor(s.reviews, v.id),
        campaigns: camps.filter((c) => c.venue_id === v.id).map(publicCampaign),
      }));
  },

  async getVenue(id) {
    const s = await load();
    const venue = s.venues.find((v) => v.id === id && v.is_active);
    if (!venue) return null;
    return {
      venue: publicVenue(venue),
      stats: statsFor(s.reviews, id),
      campaigns: liveCampaigns(s)
        .filter((c) => c.venue_id === id)
        .map(publicCampaign),
      reviews: s.reviews
        .filter((r) => r.venue_id === id && visible(r))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((r) => toReviewItem(s, r)),
    };
  },

  async saveReview(venueId, scores, comment) {
    await delay();
    const { s, u } = await currentUser();
    if (!isVerified(u)) throw new AppError('VERIFY', 'Yorum yapmak için öğrenci doğrulaman güncel olmalı.');
    if (!s.venues.some((v) => v.id === venueId && v.is_active)) throw new AppError('VENUE', 'Mekan kapalı.');
    for (const v of Object.values(scores)) {
      if (!(v >= 1 && v <= 5)) throw new AppError('SCORE', 'Dört kriterin hepsine 1-5 arası puan ver.');
    }
    const text = comment.trim().slice(0, 500) || null;
    const now = iso();
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
        venue_name: s.venues.find((v) => v.id === r.venue_id)?.name ?? '—',
        is_hidden: !!r.hidden_at,
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
    if (!isVerified(u)) throw new AppError('VERIFY', 'Kampanya kodu için doğrulanmış öğrenci olmalısın.');
    if (!liveCampaigns(s).some((c) => c.id === campaignId)) throw new AppError('CAMPAIGN', 'Kampanya aktif değil.');
    const existing = s.redemptions.find(
      (r) => r.user_id === u.id && r.campaign_id === campaignId && !r.used_at && new Date(r.expires_at).getTime() > Date.now(),
    );
    if (existing) {
      const { user_id: _u, created_at: _c, ...pub } = existing;
      return pub;
    }
    let code = '';
    do code = randomCode(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
    while (s.redemptions.some((r) => r.code === code));
    const red = {
      id: uid(),
      user_id: u.id,
      campaign_id: campaignId,
      code,
      expires_at: iso(Date.now() + 10 * 60 * 1000),
      used_at: null,
      created_at: iso(),
    };
    s.redemptions.push(red);
    await save(s);
    const { user_id: _u, created_at: _c, ...pub } = red;
    return pub;
  },

  async submitApplication(input) {
    await delay();
    const a = {
      venue_name: input.venue_name.trim(),
      contact_name: input.contact_name.trim(),
      phone: input.phone.replace(/[^\d+]/g, ''),
      email: input.email.trim().toLowerCase(),
      district: input.district?.trim() || null,
      note: input.note?.trim() || null,
    };
    if (a.venue_name.length < 2 || a.venue_name.length > 80) throw new AppError('APPLY', 'Mekan adı 2-80 karakter olmalı.');
    if (a.contact_name.length < 2 || a.contact_name.length > 60) throw new AppError('APPLY', 'Adın 2-60 karakter olmalı.');
    if (a.phone.length < 7 || a.phone.length > 20) throw new AppError('APPLY', 'Telefon numarasını kontrol et.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) throw new AppError('APPLY', 'Geçerli bir e-posta adresi gir.');
    if ((a.district ?? '').length > 40) throw new AppError('APPLY', 'Semt en fazla 40 karakter.');
    if ((a.note ?? '').length > 500) throw new AppError('APPLY', 'Not en fazla 500 karakter.');
    const s = await load();
    const recent = s.applications.some(
      (x) => (x.phone === a.phone || x.email === a.email) && Date.now() - new Date(x.created_at).getTime() < DAY,
    );
    if (recent) throw new AppError('APPLY', 'Bu iletişim bilgisiyle son 24 saatte zaten başvuru yapılmış.');
    s.applications.unshift({ ...a, id: uid(), status: 'beklemede', created_at: iso(), admin_note: null, venue_id: null, decided_at: null });
    await save(s);
  },

  // ---------------- Mekan sahibi ----------------

  async myVenues() {
    const { s, u } = await currentUser();
    return s.venues
      .filter((v) => v.owner_id === u.id)
      .map(({ owner_id: _o, ...v }) => v)
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  },

  async ownerDashboard(venueId) {
    const { s, u } = await currentUser();
    const v = ownedVenue(s, u, venueId);
    const since = Date.now() - 30 * DAY;
    const camps = s.campaigns.filter((c) => c.venue_id === venueId);
    const campIds = new Set(camps.map((c) => c.id));
    return {
      venue: (({ owner_id: _o, ...rest }) => rest)(v),
      stats: statsFor(s.reviews, venueId),
      favorites: s.favorites.filter((f) => f.venue_id === venueId).length,
      campaigns: [...camps].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(publicCampaign),
      redemptions: s.redemptions
        .filter((r) => campIds.has(r.campaign_id) && new Date(r.created_at ?? r.expires_at).getTime() > since)
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
        .map((r) => ({
          id: r.id,
          campaign_id: r.campaign_id,
          campaign_title: camps.find((c) => c.id === r.campaign_id)?.title ?? '—',
          created_at: r.created_at ?? r.expires_at,
          expires_at: r.expires_at,
          used_at: r.used_at,
        })),
      reviews: s.reviews
        .filter((r) => r.venue_id === venueId && visible(r))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 30)
        .map((r) => toReviewItem(s, r)),
    };
  },

  async createCampaign(venueId, input) {
    await delay();
    const { s, u } = await currentUser();
    const v = ownedVenue(s, u, venueId);
    const problem = validateCampaign(input);
    if (problem) throw new AppError('CAMPAIGN', problem);
    if (!v.is_active) throw new AppError('CAMPAIGN', 'Mekan kapalıyken kampanya açılamaz.');
    if (countLive(s, venueId) >= MAX_LIVE_CAMPAIGNS) {
      throw new AppError('CAMPAIGN', `Aynı anda en fazla ${MAX_LIVE_CAMPAIGNS} kampanya yürürlükte olabilir. Önce birini durdur.`);
    }
    s.campaigns.push({
      id: uid(),
      venue_id: venueId,
      title: input.title.trim(),
      discount_text: input.discount_text.trim(),
      description: input.description?.trim() || null,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      is_active: true,
      created_at: iso(),
    });
    await save(s);
  },

  async updateCampaign(id, patch) {
    await delay();
    const { s, u } = await currentUser();
    const c = s.campaigns.find((x) => x.id === id);
    if (!c) throw new AppError('FORBIDDEN', 'Kampanya bulunamadı.');
    const v = ownedVenue(s, u, c.venue_id);
    const next = { ...c, ...patch };
    const end = new Date(next.ends_at).getTime();
    if (patch.ends_at !== undefined) {
      if (end <= Date.now()) throw new AppError('CAMPAIGN', 'Bitiş tarihi geçmişte olamaz.');
      if (end <= new Date(next.starts_at).getTime()) throw new AppError('CAMPAIGN', 'Bitiş, başlangıçtan sonra olmalı.');
      if (end - new Date(next.starts_at).getTime() > MAX_CAMPAIGN_DAYS * DAY) {
        throw new AppError('CAMPAIGN', `Bir kampanya en fazla ${MAX_CAMPAIGN_DAYS} gün sürebilir.`);
      }
    }
    if (patch.is_active && !c.is_active) {
      if (end <= Date.now()) throw new AppError('CAMPAIGN', 'Süresi bitmiş kampanya yeniden başlatılamaz; yenisini aç.');
      if (!v.is_active) throw new AppError('CAMPAIGN', 'Mekan kapalıyken kampanya açılamaz.');
      if (countLive(s, c.venue_id, c.id) >= MAX_LIVE_CAMPAIGNS) {
        throw new AppError('CAMPAIGN', `Aynı anda en fazla ${MAX_LIVE_CAMPAIGNS} kampanya yürürlükte olabilir. Önce birini durdur.`);
      }
    }
    Object.assign(c, patch);
    await save(s);
  },

  async redeemCode(raw) {
    await delay(150);
    const { s, u } = await currentUser();
    const mine = s.venues.filter((v) => v.owner_id === u.id);
    if (!mine.length) throw new AppError('FORBIDDEN', 'Kod doğrulamak için mekan hesabıyla giriş yapmalısın.');
    const now = Date.now();
    s.attempts = s.attempts.filter((a) => now - a.at < DAY);
    const fails = s.attempts.filter((a) => a.owner_id === u.id && !a.ok && now - a.at < 10 * 60 * 1000).length;
    const result = (ok: boolean, reason: RedeemResult['reason'], title: string | null = null, used: string | null = null) => {
      if (reason !== 'LIMIT') s.attempts.push({ owner_id: u.id, at: now, ok });
      return { ok, reason, campaign_title: title, used_at: used } as RedeemResult;
    };
    let out: RedeemResult;
    const code = normalizeCode(raw);
    if (fails >= REDEEM_FAIL_LIMIT) out = result(false, 'LIMIT');
    else if (!code) out = result(false, 'FORMAT');
    else {
      const r = s.redemptions.find((x) => x.code === code);
      const c = r && s.campaigns.find((x) => x.id === r.campaign_id);
      const v = c && mine.find((x) => x.id === c.venue_id);
      if (!r || !c || !v) out = result(false, 'NOT_FOUND');
      else if (r.used_at) out = result(false, 'USED', c.title, r.used_at);
      else if (new Date(r.expires_at).getTime() < now) out = result(false, 'EXPIRED', c.title);
      else if (!c.is_active || !v.is_active) out = result(false, 'STOPPED', c.title);
      else {
        r.used_at = iso(now);
        out = result(true, 'OK', c.title, r.used_at);
      }
    }
    await save(s);
    return out;
  },

  // ---------------- Admin ----------------

  async adminApplications() {
    await requireRole('admin');
    const s = await load();
    return [...s.applications].sort((a, b) => b.created_at.localeCompare(a.created_at));
  },

  async adminUpdateApplication(id, patch) {
    const { s } = await requireRole('admin');
    const a = s.applications.find((x) => x.id === id);
    if (!a) throw new AppError('NOT_FOUND', 'Başvuru bulunamadı.');
    if (patch.status && a.status === 'onaylandi') throw new AppError('APP', 'Onaylanmış başvurunun durumu değiştirilemez.');
    if (patch.admin_note !== undefined) a.admin_note = patch.admin_note?.trim().slice(0, 500) || null;
    if (patch.status && patch.status !== a.status) {
      a.status = patch.status;
      a.decided_at = iso();
    }
    await save(s);
  },

  async adminApprove(applicationId, venue, owner): Promise<InviteResult> {
    await delay();
    const { s } = await requireRole('admin');
    const a = s.applications.find((x) => x.id === applicationId);
    if (!a) throw new AppError('NOT_FOUND', 'Başvuru bulunamadı.');
    if (a.status === 'onaylandi' || a.status === 'reddedildi') throw new AppError('APP', 'Bu başvuru zaten sonuçlanmış.');
    const problem = validateVenue(venue);
    if (problem) throw new AppError('VENUE', problem);
    const { owner: o, created } = ensureOwner(s, owner.email, owner.name);
    const id = uid();
    s.venues.push({
      id,
      name: venue.name.trim(),
      category: venue.category,
      description: venue.description?.trim() || null,
      district: venue.district.trim(),
      address: venue.address?.trim() || null,
      lat: venue.lat,
      lng: venue.lng,
      price_level: venue.price_level as 1 | 2 | 3,
      university_id: null,
      is_active: true,
      owner_id: o.id,
    });
    a.status = 'onaylandi';
    a.venue_id = id;
    a.decided_at = iso();
    if (created) sendPasswordMail(s, o.email, true);
    await save(s);
    emitMail();
    return { newAccount: created, mailSent: created, mailError: null };
  },

  async adminVenues() {
    const { s } = await requireRole('admin');
    const now = Date.now();
    return s.venues
      .map((v) => {
        const o = s.users.find((u) => u.id === v.owner_id);
        const { owner_id: _o, ...rest } = v;
        return {
          ...rest,
          owner_email: o?.email ?? null,
          owner_name: o?.display_name ?? null,
          owner_joined: !!o?.password,
          live_campaigns: s.campaigns.filter(
            (c) => c.venue_id === v.id && c.is_active && new Date(c.ends_at).getTime() > now,
          ).length,
          review_count: s.reviews.filter((r) => r.venue_id === v.id && visible(r)).length,
        };
      })
      .sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name, 'tr'));
  },

  async adminUpdateVenue(id, patch) {
    const { s } = await requireRole('admin');
    const v = s.venues.find((x) => x.id === id);
    if (!v) throw new AppError('NOT_FOUND', 'Mekan bulunamadı.');
    const next = { ...v, ...patch } as DemoVenue;
    const problem = validateVenue({ ...next, address: next.address, description: next.description });
    if (problem) throw new AppError('VENUE', problem);
    Object.assign(v, patch);
    await save(s);
  },

  async adminAssignOwner(venueId, owner) {
    await delay();
    const { s } = await requireRole('admin');
    const v = s.venues.find((x) => x.id === venueId);
    if (!v) throw new AppError('NOT_FOUND', 'Mekan bulunamadı.');
    const { owner: o, created } = ensureOwner(s, owner.email, owner.name);
    v.owner_id = o.id;
    if (created) sendPasswordMail(s, o.email, true);
    await save(s);
    emitMail();
    return { newAccount: created, mailSent: created, mailError: null };
  },

  async adminResendInvite(venueId) {
    const { s } = await requireRole('admin');
    const v = s.venues.find((x) => x.id === venueId);
    const o = v && s.users.find((u) => u.id === v.owner_id);
    if (!o) throw new AppError('NOT_FOUND', 'Bu mekanın sahibi yok.');
    sendPasswordMail(s, o.email, !o.password);
    await save(s);
    emitMail();
  },

  async adminDetachOwner(venueId) {
    const { s } = await requireRole('admin');
    const v = s.venues.find((x) => x.id === venueId);
    if (v) v.owner_id = null;
    await save(s);
  },

  async adminReviews(onlyHidden) {
    const { s } = await requireRole('admin');
    return s.reviews
      .filter((r) => !onlyHidden || r.hidden_at)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 200)
      .map((r) => ({
        id: r.id,
        venue_id: r.venue_id,
        venue_name: s.venues.find((v) => v.id === r.venue_id)?.name ?? '—',
        display_name: author(s, r.user_id).display_name,
        price: r.price,
        study: r.study,
        portion: r.portion,
        vibe: r.vibe,
        comment: r.comment,
        updated_at: r.updated_at,
        hidden_at: r.hidden_at ?? null,
      }));
  },

  async adminSetReviewHidden(id, hidden) {
    const { s } = await requireRole('admin');
    const r = s.reviews.find((x) => x.id === id);
    if (!r) throw new AppError('NOT_FOUND', 'Yorum bulunamadı.');
    r.hidden_at = hidden ? (r.hidden_at ?? iso()) : null;
    await save(s);
  },

  async adminCampuses() {
    const { s } = await requireRole('admin');
    return [...s.campuses].sort((a, b) => a.university_id - b.university_id || a.name.localeCompare(b.name, 'tr'));
  },

  async adminSaveCampus(c) {
    const { s } = await requireRole('admin');
    const name = c.name.trim();
    if (name.length < 2) throw new AppError('CAMPUS', 'Kampüs adı en az 2 karakter olmalı.');
    if (!inIstanbul(c.lat, c.lng)) throw new AppError('CAMPUS', 'Konum İstanbul sınırları içinde olmalı.');
    if (s.campuses.some((x) => x.university_id === c.university_id && x.name === name && x.id !== c.id)) {
      throw new AppError('CAMPUS', 'Bu üniversitede aynı adla bir kampüs var.');
    }
    const row = { ...c, name, district: c.district?.trim() || null };
    if (c.id) {
      const x = s.campuses.find((y) => y.id === c.id);
      if (!x) throw new AppError('NOT_FOUND', 'Kampüs bulunamadı.');
      Object.assign(x, row);
    } else {
      s.campuses.push({ ...row, id: Math.max(0, ...s.campuses.map((y) => y.id)) + 1 });
    }
    await save(s);
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
      if (u.role !== 'venue_owner') u.verified_at = iso();
      s.sessionUserId = u.id; // Supabase'de de link oturumu açar
    }
    m.opened = true;
    await save(s);
    emitMail();
    emit(s, 'SIGNED_IN');
  },

  /** Şifre belirleme linkine tıklamayı taklit eder: oturum açılır, şifre ekranına gidilir. */
  async openResetLink(mailId: string) {
    const s = await load();
    const m = s.outbox.find((x) => x.id === mailId);
    const u = m && s.users.find((x) => x.email === m.to);
    if (!m || !u) return;
    u.email_confirmed = true;
    s.sessionUserId = u.id;
    m.opened = true;
    await save(s);
    emitMail();
    emit(s, 'PASSWORD_RECOVERY');
  },

  /** Sunumda yıllık yeniden doğrulamayı göstermek için doğrulamayı 1 yıl geriye atar. */
  async expireVerification() {
    const { s, u } = await currentUser();
    u.verified_at = iso(Date.now() - YEAR - DAY);
    await save(s);
  },

  async reset() {
    const s = freshStore();
    await save(s);
    emit(s, 'SIGNED_OUT');
    emitMail();
  },
};
