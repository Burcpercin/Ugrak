import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { Profile, SessionInfo } from './types';

const YEAR_MS = 365 * 24 * 3600 * 1000;

type AuthState = {
  ready: boolean;
  session: SessionInfo;
  profile: Profile | null;
  /** Doğrulama son 1 yıl içinde mi? */
  verified: boolean;
  /** Doğrulamanın bitmesine kalan gün (doğrulanmamışsa 0). */
  daysLeft: number;
  refreshProfile: () => Promise<void>;
  setProfile: (p: Profile) => void;
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

  const refreshProfile = useCallback(async () => {
    try {
      setProfile(await api.getProfile());
    } catch {
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await api.getSession();
      if (!alive) return;
      setSession(s);
      if (s) await refreshProfile();
      if (alive) setReady(true);
    })();
    const off = api.onAuthChange(async (s) => {
      setSession(s);
      if (s) await refreshProfile();
      else setProfile(null);
    });
    return () => {
      alive = false;
      off();
    };
  }, [refreshProfile]);

  const value = useMemo<AuthState>(() => {
    const v = verificationInfo(profile);
    return { ready, session, profile, verified: v.verified, daysLeft: v.daysLeft, refreshProfile, setProfile };
  }, [ready, session, profile, refreshProfile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return v;
}
