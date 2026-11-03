import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { api } from './api';
import { useAuth } from './auth';
import type { Campus } from './types';
import { STATIC_CAMPUSES, universityById } from './universities';

// =====================================================================
// KONUM — "yakınımdakiler"
// Mesafe tamamen cihazda hesaplanır: konum sunucuya gönderilmez, kalıcı
// olarak saklanmaz (sadece uygulama açıkken bellekte). Cihazda yalnızca
// kişinin TERCİHİ saklanır: "konumumu kullan" ya da seçtiği kampüsün numarası.
// İzin verilmezse kişi kampüs seçer; öğrenci hiçbir şey seçmediyse okulunun
// ana kampüsü varsayılır.
// =====================================================================

export type Origin = {
  lat: number;
  lng: number;
  /** Ekranda: "Konumun", "Arel · Cevizlibağ Yerleşkesi" */
  label: string;
  source: 'gps' | 'campus' | 'default';
};

type Choice = { source: 'gps' } | { source: 'campus'; campusId: number } | null;
type Status = 'idle' | 'locating' | 'denied' | 'error';

type LocationState = {
  origin: Origin | null;
  status: Status;
  campuses: Campus[];
  /** Konumu ister; başarılıysa true döner. */
  locateMe: () => Promise<boolean>;
  chooseCampus: (c: Campus) => Promise<void>;
  clearChoice: () => Promise<void>;
};

const K_CHOICE = 'ugrak.konum.tercih';
const Ctx = createContext<LocationState | null>(null);

export function campusLabel(c: Campus) {
  const u = universityById(c.university_id);
  return u ? `${u.short_name} · ${c.name}` : c.name;
}

async function saveChoice(c: Choice) {
  try {
    if (c) await AsyncStorage.setItem(K_CHOICE, JSON.stringify(c));
    else await AsyncStorage.removeItem(K_CHOICE);
  } catch {
    // depo yoksa tercih bu oturumda kalır
  }
}

async function readChoice(): Promise<Choice> {
  try {
    const raw = await AsyncStorage.getItem(K_CHOICE);
    const c = raw ? JSON.parse(raw) : null;
    if (c?.source === 'gps') return c;
    if (c?.source === 'campus' && Number.isInteger(c.campusId)) return c;
  } catch {
    // yok say
  }
  return null;
}

function timeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
}

/** İzin verilmişse konumu al; önce hızlı (son bilinen), olmazsa yeni ölçüm. */
async function readPosition(): Promise<{ lat: number; lng: number } | null> {
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 2000 });
    if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
  } catch {
    // web'de ya da servis kapalıysa yeni ölçüme geç
  }
  const cur = await timeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 12000);
  return { lat: cur.coords.latitude, lng: cur.coords.longitude };
}

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [campuses, setCampuses] = useState<Campus[]>(STATIC_CAMPUSES);
  const [choice, setChoice] = useState<Choice>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    api.listCampuses().then(setCampuses).catch(() => {});
    readChoice().then(async (c) => {
      setChoice(c);
      if (c?.source !== 'gps') return;
      // Daha önce "konumumu kullan" denmiş: izin hâlâ varsa sessizce konumu al, sormadan.
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) return setStatus('denied');
        setStatus('locating');
        setGps(await readPosition());
        setStatus('idle');
      } catch {
        setStatus('error');
      }
    });
  }, []);

  const locateMe = useCallback(async () => {
    setStatus('locating');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setStatus('denied');
        return false;
      }
      const pos = await readPosition();
      setGps(pos);
      setChoice({ source: 'gps' });
      await saveChoice({ source: 'gps' });
      setStatus('idle');
      return true;
    } catch {
      setStatus('error');
      return false;
    }
  }, []);

  const chooseCampus = useCallback(async (c: Campus) => {
    setChoice({ source: 'campus', campusId: c.id });
    setStatus('idle');
    await saveChoice({ source: 'campus', campusId: c.id });
  }, []);

  const clearChoice = useCallback(async () => {
    setChoice(null);
    setGps(null);
    setStatus('idle');
    await saveChoice(null);
  }, []);

  const origin = useMemo<Origin | null>(() => {
    if (choice?.source === 'gps' && gps) return { ...gps, label: 'Konumun', source: 'gps' };
    if (choice?.source === 'campus') {
      const c = campuses.find((x) => x.id === choice.campusId);
      if (c) return { lat: c.lat, lng: c.lng, label: campusLabel(c), source: 'campus' };
    }
    if (!choice) {
      const u = universityById(profile?.university_id);
      if (u) return { lat: u.lat, lng: u.lng, label: `${u.short_name} · ${u.campus_name}`, source: 'default' };
    }
    return null;
  }, [choice, gps, campuses, profile?.university_id]);

  const value = useMemo(
    () => ({ origin, status, campuses, locateMe, chooseCampus, clearChoice }),
    [origin, status, campuses, locateMe, chooseCampus, clearChoice],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocation() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLocation, LocationProvider içinde kullanılmalı');
  return v;
}
