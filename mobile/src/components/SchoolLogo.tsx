import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

// Bundled with the app so the crest always shows, even offline or while the school server is waking up.
const LOGO = require('../../assets/school-logo.png');

export const SchoolLogo: React.FC<{ size?: number; framed?: boolean }> = ({ size = 34, framed = true }) => (
  <View
    style={[
      styles.frame,
      framed && styles.framed,
      { width: size, height: size, borderRadius: size / 2 },
    ]}
    accessible
    accessibilityLabel="Residential PDS Public School logo"
  >
    <Image source={LOGO} style={{ width: size - (framed ? 4 : 0), height: size - (framed ? 4 : 0) }} resizeMode="contain" />
  </View>
);

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center' },
  framed: { backgroundColor: '#FFFFFF' },
});
