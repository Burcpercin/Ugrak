import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { colors, fonts } from '@/theme';
import { Button, Row } from './ui';

/**
 * Panellerde form penceresi. Arkaya dokununca kapanmaz (yarım form kaybolmasın);
 * sadece ✕ ya da Vazgeç ile kapanır.
 */
export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: 'rgba(27,27,27,0.55)', justifyContent: 'center', padding: 14 }}
      >
        {/* Yükseklik sınırlı kutu + esneyebilen kaydırma alanı: uzun formlar telefonda ve webde kaydırılabilir */}
        <View
          style={{
            width: '100%',
            maxWidth: 580,
            maxHeight: '94%',
            alignSelf: 'center',
            backgroundColor: colors.paper,
            borderWidth: 3,
            borderColor: colors.ink,
            overflow: 'hidden',
          }}
        >
          <Row style={{ justifyContent: 'space-between', padding: 16, paddingBottom: 8, borderBottomWidth: 2, borderColor: '#e2dacb' }}>
            <Text style={{ fontFamily: fonts.pixel, fontSize: 20, color: colors.ink, flex: 1 }}>{title}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Kapat" hitSlop={10}>
              <Text style={{ fontFamily: fonts.pixel, fontSize: 18, color: colors.ink }}>✕</Text>
            </Pressable>
          </Row>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 12 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Geri alınması zor işlemler için iki aşamalı buton: ilk dokunuş "Emin misin?"
 * sorar, 4 saniye içinde ikinci dokunuş işlemi yapar. (Tarayıcı onay pencereleri
 * kullanılmaz; telefonda ve webde aynı davranır.)
 */
export function ConfirmButton({
  title,
  confirmTitle = 'EMİN MİSİN? TEKRAR DOKUN',
  onConfirm,
  variant = 'danger',
  loading,
  disabled,
}: {
  title: string;
  confirmTitle?: string;
  onConfirm: () => void;
  variant?: 'danger' | 'secondary' | 'primary' | 'accent' | 'success';
  loading?: boolean;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => (t.current ? clearTimeout(t.current) : undefined), []);
  return (
    <Button
      small
      variant={armed ? 'danger' : variant}
      title={armed ? confirmTitle : title}
      loading={loading}
      disabled={disabled}
      onPress={() => {
        if (armed) {
          setArmed(false);
          if (t.current) clearTimeout(t.current);
          onConfirm();
        } else {
          setArmed(true);
          t.current = setTimeout(() => setArmed(false), 4000);
        }
      }}
    />
  );
}

export function Pill({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderWidth: 2,
        borderColor: colors.ink,
        backgroundColor: active ? colors.ink : colors.card,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ fontFamily: fonts.pixel, fontSize: 13, color: active ? '#fff' : colors.ink }}>{label}</Text>
    </Pressable>
  );
}

export const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('tr-TR') : '—');
export const fmtDateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
