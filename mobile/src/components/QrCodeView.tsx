import React, { useMemo } from 'react';
import { View } from 'react-native';
import { buildQrMatrix } from '../utils/qrMatrix';

interface QrCodeViewProps {
  value: string;
  size: number;
  dark?: string;
  light?: string;
}

/** Scannable QR drawn with Views. Edges are rounded so neighbouring runs never leave seams. */
export const QrCodeView: React.FC<QrCodeViewProps> = React.memo(({ value, size, dark = '#091b2c', light = '#ffffff' }) => {
  const matrix = useMemo(() => buildQrMatrix(value, 'M'), [value]);
  // One module of quiet zone on each side, like the website's `margin: 1`.
  const cells = matrix.count + 2;
  const unit = size / cells;
  const edge = (n: number) => Math.round((n + 1) * unit);

  return (
    <View style={{ width: size, height: size, backgroundColor: light }} accessibilityLabel="Staff verification QR code">
      {matrix.runs.map((r, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: edge(r.start),
            top: edge(r.row),
            width: edge(r.start + r.len) - edge(r.start),
            height: edge(r.row + 1) - edge(r.row),
            backgroundColor: dark,
          }}
        />
      ))}
    </View>
  );
});
