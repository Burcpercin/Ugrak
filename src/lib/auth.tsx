import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import { api, errorMessage } from './api';
import { guestStore } from './guestStore';
import { isNative } from './useLayout';
import type { AvatarConfig, Profile, SessionInfo } from './types';

const YEAR_MS = 365 * 24 * 3600 * 1000;

/** Bir işlem belirtilen sürede bitmezse hata ver (açılışın sonsuza kadar beklememesi için). */
function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} ${Math.round(ms / 1000)} saniyede yanıt vermedi.`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Kullanıcının uygulamadaki durumu:
 * - guest: giriş yapmamış. Her şeyi görür, kampanya kodu alamaz, puan veremez.
 * - pending: hesap açılmış ama okul e-postası henüz doğrulanmamış.
 * - expired: yıllık doğrulaması dolmuş. Misafir gibi gezer, yenileyince öğrenci olur.
 * - student: doğrulaması geçerli öğrenci (admin de öğrencidir).
 * - owner: mekan sahibi hesabı. Gezebilir, ama öğrenci sayılmaz.
 */
export type Access = 'guest' | 'pending' | 'expired' | 'student' | 'owner';

type AuthState = {
  ready: boolean;
  access: Access;
  isAdmin: boolean;
  /** Kişi şifre belirleme linkiyle geldi; şifre ekranına gönderilmeli. */
  recovery: boolean;
  clearRecovery: () => void;
  /** Ekranda gösterilecek karakter: öğrencininki ya da misafirin cihazındaki. */
  avatar: AvatarConfig | null;
  guestAvatar: AvatarConfig | null;
  setGuestAvatar: (a: AvatarConfig) => Promise<void>;
  session: SessionInfo;
  profile: Profile | null;
  /** Doğrulama son 1 yıl içinde mi? */
  verified: boolean;
  /** Doğrulamanın bitmesine kalan gün (doğrulanmamışsa 0). */
  daysLeft: number;
  refreshProfile: () => Promise<void>;
  setProfile: (p: Profile) => void;
  /** Telefonda doğrulama linkiyle gelinip oturum açılamadıysa nedeni. */
  linkError: string | null;
  clearLinkError: () => void;
  /**
   * Oturum açık ama profil yüklenemediyse nedeni (bağlantı yok, profil satırı yok vb.).
   * Ekranlar bu durumda sonsuz yükleme yerine hata ve "tekrar dene" gösterir.
   */
  profileError: string | null;
};

const Ctx = createContext<AuthState | null>(null);

export function verificationInfo(p: Profile | null) {
  if (!p?.verified_at) return { verified: false, daysLeft: 0 };
  const left = new Date(p.verified_at).getTime() + YEAR_MS - Date.now();
  return { verified: left > 0, daysLeft: Math.max(0, Math.ceil(left / (24 * 3600 * 1000))) };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<SessionInfo>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [guestAvatar, setGuestAvatarState] = useState<AvatarConfig | null>(null);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    guestStore.avatar().then(setGuestAvatarState);
  }, []);

  const setGuestAvatar = useCallback(async (a: AvatarConfig) => {
    setGuestAvatarState(a);
    await guestStore.setAvatar(a);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await withTimeout(api.getProfile(), 15000, 'Sunucu');
      setProfile(p);
      setProfileError(p ? null : 'Profil bulunamadı. Çıkış yapıp tekrar giriş yapmayı dene.');
    } catch (e) {
      setProfile(null);
      setProfileError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await withTimeout(api.getSession(), 10000, 'Oturum kontrolü');
        if (!alive) return;
        setSession(s);
        if (s) await refreshProfile();
      } catch (e) {
        // Oturum okunamadıysa giriş ekranından devam et; uygulama açılışta takılmasın.
        console.warn('[Uğrak] Oturum okunamadı:', e);
        if (alive) setSession(null);
      } finally {
        if (alive) setReady(true);
      }
    })();
    const off = api.onAuthChange(async (s, event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (!s) setRecovery(false);
      setSession(s);
      if (s) await refreshProfile();
      else {
        setProfile(null);
        setProfileError(null);
      }
    });
    return () => {
      alive = false;
      off();
    };
  }, [refreshProfile]);

  // Telefonda: okul mailindeki doğrulama linki uygulamayı açarsa (ugrak:// ya da
  // Expo Go'da exp://), linkteki bilgilerle oturumu kur. Uygulama kapalıyken
  // açıldıysa ilk adres, açıkken geldiyse 'url' olayı kullanılır.
  useEffect(() => {
    if (!isNative) return;
    const handle = async (link: string | null) => {
      if (!link) return;
      try {
        const r = await api.handleAuthRedirect(link);
        if (r === 'recovery') setRecovery(true);
      } catch (e) {
        setLinkError(errorMessage(e));
      }
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);

  // Yıllık doğrulaması dolmuş kişi okul mailindeki yenileme linkine tıkladıysa
  // oturum o linkle açılmıştır: doğrulamayı sessizce yenile (kod yazmasına gerek kalmaz).
  // Şifreyle girdiyse veritabanı reddeder, kişi kodla yenileme ekranını kullanır.
  const triedRefresh = useRef<string | null>(null);
  const expiredId =
    profile && profile.role !== 'venue_owner' && profile.verified_at && !verificationInfo(profile).verified
      ? profile.id
      : null;
  useEffect(() => {
    if (!expiredId || triedRefresh.current === expiredId) return;
    triedRefresh.current = expiredId;
    api
      .tryRefreshVerification()
      .then((ok) => (ok ? refreshProfile() : undefined))
      .catch(() => {});
  }, [expiredId, refreshProfile]);

  // Misafirken eklenen favorileri, öğrenci hesabı doğrulanınca hesaba taşı.
  const studentId = profile && verificationInfo(profile).verified ? profile.id : null;
  useEffect(() => {
    if (!studentId) return;
    (async () => {
      const local = await guestStore.favorites();
      if (local.length === 0) return;
      try {
        const remote = await api.listFavorites();
        for (const id of local) if (!remote.includes(id)) await api.toggleFavorite(id);
        await guestStore.clearFavorites();
      } catch {
        // bir dahaki girişte tekrar denenir; yerel liste silinmez
      }
    })();
  }, [studentId]);

  const value = useMemo<AuthState>(() => {
    const v = verificationInfo(profile);
    const access: Access = !session
      ? 'guest'
      : profile?.role === 'venue_owner'
        ? 'owner'
        : v.verified
        ? 'student'
        : profile?.verified_at
          ? 'expired'
          : 'pending';
    const own = profile?.avatar && Object.keys(profile.avatar).length ? profile.avatar : null;
    return {
      ready,
      access,
      isAdmin: profile?.role === 'admin',
      recovery,
      clearRecovery: () => setRecovery(false),
      avatar: session ? own : guestAvatar,
      guestAvatar,
      setGuestAvatar,
      session,
      profile,
      verified: v.verified,
      daysLeft: v.daysLeft,
      refreshProfile,
      setProfile,
      linkError,
      clearLinkError: () => setLinkError(null),
      profileError,
    };
  }, [ready, session, profile, refreshProfile, linkError, profileError, guestAvatar, setGuestAvatar, recovery]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return v;
}
