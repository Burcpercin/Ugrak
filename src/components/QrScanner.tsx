import React, { useRef, useState } from 'react';
import { Linking, Modal, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { normalizeCode } from '@/lib/rules';
import { colors, fonts } from '@/theme';
import { Box, Button, H2, P, Small } from './ui';

/**
 * Mekan panelinde öğrencinin kampanya QR kodunu okutur (telefonda).
 * QR içeriği "UGRAK:KOD". Uğrak kodu olmayan QR'lar yok sayılır.
 * Görüntü kaydedilmez; sadece okunan metin kullanılır.
 */
export function QrScanner({ visible, onCode, onClose }: { visible: boolean; onCode: (code: string) => void; onClose: () => void }) {
  const [perm, requestPerm] = useCameraPermissions();
  const insets = useSafeAreaInsets();
  const lock = useRef(false);
  const [hint, setHint] = useState<string | null>(null);

  const close = () => {
    lock.current = false;
    setHint(null);
    onClose();
  };

  let body: React.ReactNode;
  if (!perm) {
    body = <P style={{ color: '#fff' }}>Kamera hazırlanıyor…</P>;
  } else if (!perm.granted) {
    body = (
      <Box bg={colors.paper} style={{ margin: 20 }}>
        <H2 style={{ marginBottom: 6 }}>Kamera izni</H2>
        <P style={{ fontSize: 14, marginBottom: 12 }}>
          Öğrencinin QR kodunu okutmak için kamera izni gerekiyor. Görüntü kaydedilmez. İstersen kodu elle de yazabilirsin.
        </P>
        {perm.canAskAgain ? (
          <Button title="İZİN VER" onPress={() => requestPerm()} />
        ) : (
          <Button title="AYARLARI AÇ" onPress={() => Linking.openSettings()} />
        )}
        <Button small variant="secondary" title="Kodu elle yaz" onPress={close} style={{ marginTop: 10 }} />
      </Box>
    );
  } else {
    body = (
      <View style={{ flex: 1 }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            if (lock.current) return;
            const code = normalizeCode(String(data ?? ''));
            if (!code || !/^UGRAK/i.test(String(data).trim())) {
              setHint('Bu bir Uğrak kampanya kodu değil.');
              return;
            }
            lock.current = true; // aynı kod art arda birkaç kez okunmasın
            onCode(code);
            close();
          }}
        />
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 230, height: 230, borderWidth: 4, borderColor: colors.orange }} />
          <Text style={{ fontFamily: fonts.pixel, color: '#fff', marginTop: 14, fontSize: 15 }}>QR kodu kareye getir</Text>
          {hint ? <Small style={{ color: colors.orangeSoft, marginTop: 6 }}>{hint}</Small> : null}
        </View>
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: insets.top, paddingBottom: insets.bottom, justifyContent: 'center' }}>
        {body}
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          style={{ position: 'absolute', top: insets.top + 12, right: 16, backgroundColor: colors.paper, borderWidth: 3, borderColor: colors.ink, paddingHorizontal: 12, paddingVertical: 6 }}
        >
          <Text style={{ fontFamily: fonts.pixel, color: colors.ink }}>✕ KAPAT</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
