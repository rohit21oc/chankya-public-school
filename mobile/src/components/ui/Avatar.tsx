import React, { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { BRAND_COLORS, resolveFileUrl } from '../../utils/branding';

interface Props { name?: string; photo?: string; size?: number }

/** Round photo with an initials fallback (also used when the image fails to load). */
export const Avatar: React.FC<Props> = ({ name, photo, size = 44 }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]);
  const uri = photo && !failed ? resolveFileUrl(photo) : '';
  const initials = (name || '?').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
  const box = { width: size, height: size, borderRadius: size / 2 };
  return uri ? (
    <Image source={{ uri }} style={[styles.img, box]} onError={() => setFailed(true)} accessibilityLabel={name ? `Photo of ${name}` : 'Photo'} />
  ) : (
    <View style={[styles.fallback, box]}>
      <Text style={[styles.initials, { fontSize: Math.round(size * 0.36) }]}>{initials}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  img: { backgroundColor: BRAND_COLORS.surfaceSoft },
  fallback: { backgroundColor: BRAND_COLORS.primaryRoyal, alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontWeight: '800' },
});
