import React, { useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';
// Saf JavaScript QR çekirdeği: native modül gerektirmez, her platformda çalışır.
// @ts-expect-error: paketin bu alt yolu için tip tanımı yok
import QR from 'qrcode/lib/core/qrcode';

export function QRCode({ value, size = 180 }: { value: string; size?: number }) {
  const { n, cells } = useMemo(() => {
    const qr = QR.create(value, { errorCorrectionLevel: 'M' });
    const n: number = qr.modules.size;
    const data: Uint8Array = qr.modules.data;
    const cells: { x: number; y: number }[] = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (data[y * n + x]) cells.push({ x, y });
    return { n, cells };
  }, [value]);
  const q = 2; // sessiz bölge
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${n + q * 2} ${n + q * 2}`}>
      <Rect x={0} y={0} width={n + q * 2} height={n + q * 2} fill="#fff" />
      {cells.map((c) => (
        <Rect key={`${c.x}-${c.y}`} x={c.x + q} y={c.y + q} width={1.02} height={1.02} fill="#1B1B1B" />
      ))}
    </Svg>
  );
}
