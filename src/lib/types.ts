export type University = {
  id: number;
  name: string;
  short_name: string;
  domains: string[];
  campus_name: string;
  lat: number;
  lng: number;
};

export type Campus = {
  id: number;
  university_id: number;
  name: string;
  district: string | null;
  lat: number;
  lng: number;
};

export type AvatarConfig = {
  skin: number;
  hairStyle: 'kisa' | 'uzun' | 'bere';
  hairColor: number;
  shirt: number;
  glasses: boolean;
};

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  university_id: number | null;
  avatar: AvatarConfig | null;
  role: 'student' | 'venue_owner' | 'admin';
  verified_at: string | null;
  kvkk_accepted_at: string | null;
};

export type Venue = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  district: string;
  address: string | null;
  lat: number;
  lng: number;
  price_level: 1 | 2 | 3;
  university_id: number | null;
};

export type VenueStats = {
  venue_id: string;
  review_count: number;
  avg_price: number | null;
  avg_study: number | null;
  avg_portion: number | null;
  avg_vibe: number | null;
  avg_overall: number | null;
};

export type Campaign = {
  id: string;
  venue_id: string;
  title: string;
  description: string | null;
  discount_text: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

export type Scores = { price: number; study: number; portion: number; vibe: number };

export type ReviewItem = Scores & {
  id: string;
  venue_id: string;
  /** Giriş yapan kullanıcının kendi yorumu mu? (Yazarın kimliği istemciye gönderilmez.) */
  is_mine: boolean;
  comment: string | null;
  created_at: string;
  updated_at: string;
  display_name: string;
  avatar: AvatarConfig | null;
  university_short: string | null;
};

export type Redemption = {
  id: string;
  campaign_id: string;
  code: string;
  expires_at: string;
  used_at: string | null;
};

export type VenueListItem = Venue & {
  stats: VenueStats;
  campaigns: Campaign[];
};

export type VenueDetail = {
  venue: Venue;
  stats: VenueStats;
  campaigns: Campaign[];
  reviews: ReviewItem[];
};

// ---------------- Faz 2: paneller ----------------

export type VenueInput = {
  name: string;
  category: string;
  district: string;
  address: string | null;
  description: string | null;
  lat: number;
  lng: number;
  price_level: number;
};

/** Mekan sahibinin kendi mekanı (kapalı olabilir) */
export type OwnerVenue = Venue & { is_active: boolean };

export type CampaignInput = {
  title: string;
  discount_text: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
};

/** Mekan sahibinin gördüğü kod kullanımı — öğrencinin kimliği yok */
export type VenueRedemption = {
  id: string;
  campaign_id: string;
  campaign_title: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
};

export type OwnerDashboard = {
  venue: OwnerVenue;
  stats: VenueStats;
  favorites: number;
  campaigns: Campaign[];
  redemptions: VenueRedemption[];
  reviews: ReviewItem[];
};

export type RedeemReason = 'OK' | 'USED' | 'EXPIRED' | 'NOT_FOUND' | 'FORMAT' | 'STOPPED' | 'LIMIT';
export type RedeemResult = { ok: boolean; reason: RedeemReason; campaign_title: string | null; used_at: string | null };

export type ApplicationStatus = 'beklemede' | 'gorusuldu' | 'onaylandi' | 'reddedildi';

export type ApplicationInput = {
  venue_name: string;
  contact_name: string;
  phone: string;
  email: string;
  district: string | null;
  note: string | null;
};

export type Application = ApplicationInput & {
  id: string;
  status: ApplicationStatus;
  created_at: string;
  admin_note: string | null;
  venue_id: string | null;
  decided_at: string | null;
};

export type AdminVenue = OwnerVenue & {
  owner_email: string | null;
  owner_name: string | null;
  /** Sahip şifresini belirleyip en az bir kez giriş yaptı mı? */
  owner_joined: boolean;
  live_campaigns: number;
  review_count: number;
};

export type AdminReview = Scores & {
  id: string;
  venue_id: string;
  venue_name: string;
  display_name: string;
  comment: string | null;
  updated_at: string;
  hidden_at: string | null;
};

export type AdminCampus = Campus & { is_active: boolean };

export type InviteResult = { newAccount: boolean; mailSent: boolean; mailError: string | null };

export type SignUpInput = {
  email: string;
  password: string;
  displayName: string;
  kvkkAccepted: boolean;
};

export type SessionInfo = { userId: string; email: string } | null;

// Uygulamanın kullandığı tüm veri işlemleri. Demo ve Supabase
// uygulamaları aynı arayüzü uygular; ekranlar hangisinin çalıştığını bilmez.
export interface Api {
  mode: 'demo' | 'supabase';

  getSession(): Promise<SessionInfo>;
  /** event 'PASSWORD_RECOVERY': kişi şifre belirleme linkiyle geldi. */
  onAuthChange(cb: (s: SessionInfo, event?: string) => void): () => void;
  signUp(input: SignUpInput): Promise<{ needsVerification: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  resendVerification(email: string): Promise<void>;
  /**
   * Telefonda doğrulama linki uygulamayı açtığında gelen adresten oturumu kurar.
   * Adreste oturum bilgisi yoksa false döner.
   */
  handleAuthRedirect(link: string): Promise<false | 'session' | 'recovery'>;
  /** "Şifremi unuttum" ve mekan sahibinin ilk şifresi: e-postaya şifre belirleme linki. */
  requestPasswordReset(email: string): Promise<void>;
  /** Şifre belirleme linkiyle açılan oturumda yeni şifreyi kaydet. */
  updatePassword(password: string): Promise<void>;
  /** KVKK: hesabı ve kişisel verileri kalıcı olarak sil (şifre tekrar sorulur). */
  deleteAccount(password: string): Promise<void>;

  getProfile(): Promise<Profile | null>;
  updateProfile(patch: { display_name?: string; avatar?: AvatarConfig }): Promise<Profile>;

  /** Yıllık yeniden doğrulama: edu adresine kod gönder. */
  requestReverify(email: string): Promise<void>;
  /** Gelen kodu doğrula ve doğrulama tarihini yenile. */
  confirmReverify(email: string, code: string): Promise<void>;
  /**
   * Oturum okul mailindeki linkle (son 15 dk içinde) açıldıysa doğrulamayı sessizce
   * yeniler. Şifreyle girilmişse veritabanı reddeder; o zaman false döner.
   */
  tryRefreshVerification(): Promise<boolean>;

  /** Konum izni verilmezse seçilebilecek kampüsler (herkese açık). */
  listCampuses(): Promise<Campus[]>;
  listVenues(): Promise<VenueListItem[]>;
  getVenue(id: string): Promise<VenueDetail | null>;
  saveReview(venueId: string, scores: Scores, comment: string): Promise<void>;
  deleteReview(venueId: string): Promise<void>;
  myReviews(): Promise<(ReviewItem & { venue_name: string; is_hidden?: boolean })[]>;

  listFavorites(): Promise<string[]>;
  toggleFavorite(venueId: string): Promise<boolean>;

  createRedemption(campaignId: string): Promise<Redemption>;

  /** Mekan başvurusu (herkes; giriş gerekmez) */
  submitApplication(input: ApplicationInput): Promise<void>;

  // ---- Mekan sahibi ----
  myVenues(): Promise<OwnerVenue[]>;
  ownerDashboard(venueId: string): Promise<OwnerDashboard>;
  createCampaign(venueId: string, input: CampaignInput): Promise<void>;
  updateCampaign(id: string, patch: { is_active?: boolean; ends_at?: string }): Promise<void>;
  redeemCode(code: string): Promise<RedeemResult>;

  // ---- Admin ----
  adminApplications(): Promise<Application[]>;
  adminUpdateApplication(id: string, patch: { status?: 'gorusuldu' | 'reddedildi' | 'beklemede'; admin_note?: string | null }): Promise<void>;
  /** Başvuruyu onayla: mekanı aç, sahip hesabını aç, şifre belirleme maili gönder. */
  adminApprove(applicationId: string, venue: VenueInput, owner: { email: string; name: string }): Promise<InviteResult>;
  adminVenues(): Promise<AdminVenue[]>;
  adminUpdateVenue(id: string, patch: Partial<VenueInput> & { is_active?: boolean }): Promise<void>;
  adminAssignOwner(venueId: string, owner: { email: string; name: string }): Promise<InviteResult>;
  adminResendInvite(venueId: string): Promise<void>;
  adminDetachOwner(venueId: string): Promise<void>;
  adminReviews(onlyHidden: boolean): Promise<AdminReview[]>;
  adminSetReviewHidden(id: string, hidden: boolean): Promise<void>;
  adminCampuses(): Promise<AdminCampus[]>;
  adminSaveCampus(c: Omit<AdminCampus, 'id'> & { id?: number }): Promise<void>;
}
