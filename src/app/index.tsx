import React from 'react';
import { AuthGate } from '@/components/AuthGate';

// Giriş noktası: misafir ve öğrenci Keşfet'e, eksiği olan hesap ilgili ekrana gider (bkz. AuthGate).
export default function Index() {
  return <AuthGate allowGuest />;
}
