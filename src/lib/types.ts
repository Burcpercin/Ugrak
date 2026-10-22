export type University = {
  id: number;
  name: string;
  short_name: string;
  domains: string[];
  campus_name: string;
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
  user_id: string;
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
  onAuthChange(cb: (s: SessionInfo) => void): () => void;
  signUp(input: SignUpInput): Promise<{ needsVerification: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  resendVerification(email: string): Promise<void>;

  getProfile(): Promise<Profile | null>;
  updateProfile(patch: { display_name?: string; avatar?: AvatarConfig }): Promise<Profile>;

  /** Yıllık yeniden doğrulama: edu adresine kod gönder. */
  requestReverify(email: string): Promise<void>;
  /** Gelen kodu doğrula ve doğrulama tarihini yenile. */
  confirmReverify(email: string, code: string): Promise<void>;

  listVenues(): Promise<VenueListItem[]>;
  getVenue(id: string): Promise<VenueDetail | null>;
  saveReview(venueId: string, scores: Scores, comment: string): Promise<void>;
  deleteReview(venueId: string): Promise<void>;
  myReviews(): Promise<(ReviewItem & { venue_name: string })[]>;

  listFavorites(): Promise<string[]>;
  toggleFavorite(venueId: string): Promise<boolean>;

  createRedemption(campaignId: string): Promise<Redemption>;
}
