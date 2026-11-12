import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Animated, Easing } from 'react-native';
import { BRAND_COLORS } from '../utils/branding';
import { Icon, IconName } from './teacher-home/Icon';

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secure?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'phone-pad';
  autoCapitalize?: 'none' | 'characters';
  maxLength?: number;
  editable?: boolean;
  returnKeyType?: 'next' | 'go' | 'done';
  onSubmitEditing?: () => void;
  /** Small icon at the start of the field. */
  icon?: IconName;
}

/** Labelled input with a focus highlight and an optional Show/Hide switch for passwords. */
export const LoginField: React.FC<FieldProps> = ({ label, value, onChangeText, placeholder, secure, keyboardType, autoCapitalize = 'none', maxLength, editable = true, returnKeyType, onSubmitEditing, icon }) => {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
      <View style={[styles.inputRow, focused && styles.inputRowFocused]}>
        {icon ? (
          <View style={styles.leadIcon}>
            <Icon name={icon} size={18} color={focused ? BRAND_COLORS.primaryRoyal : '#98A2B3'} />
          </View>
        ) : null}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#98A2B3"
          secureTextEntry={secure ? hidden : false}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
          editable={editable}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
        />
        {secure ? (
          <TouchableOpacity onPress={() => setHidden(!hidden)} style={styles.toggle} accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Text style={styles.toggleText}>{hidden ? 'Show' : 'Hide'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

/** Error line that shakes once each time a new message appears. */
export const LoginError: React.FC<{ message: string | null }> = ({ message }) => {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!message) return;
    x.setValue(0);
    Animated.sequence([
      Animated.timing(x, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(x, { toValue: -1, duration: 90, useNativeDriver: true }),
      Animated.timing(x, { toValue: 0.5, duration: 80, useNativeDriver: true }),
      Animated.timing(x, { toValue: 0, duration: 70, useNativeDriver: true }),
    ]).start();
  }, [message, x]);
  if (!message) return null;
  return (
    <Animated.View style={[styles.errorBox, { transform: [{ translateX: x.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) }] }]} accessibilityRole="alert">
      <Text style={styles.errorText}>{message}</Text>
    </Animated.View>
  );
};

/** Primary button: presses in slightly and shows progress while signing in. */
export const SignInButton: React.FC<{ label?: string; loading: boolean; onPress: () => void }> = ({ label = 'Login', loading, onPress }) => {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.timing(s, { toValue: v, duration: 110, useNativeDriver: true, easing: Easing.out(Easing.cubic) }).start();
  return (
    <Animated.View style={{ transform: [{ scale: s }] }}>
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonBusy]}
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.9}
        onPressIn={() => to(0.97)}
        onPressOut={() => to(1)}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.buttonText}>{label}</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
};

export const WakingNotice: React.FC<{ show: boolean }> = ({ show }) =>
  show ? (
    <View style={styles.waking}>
      <ActivityIndicator size="small" color={BRAND_COLORS.warning} />
      <Text style={styles.wakingText}>Connecting to the school server…</Text>
    </View>
  ) : null;

const styles = StyleSheet.create({
  fieldWrap: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#475467', marginBottom: 6 },
  labelFocused: { color: BRAND_COLORS.primaryRoyal },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E4E7EC', borderRadius: 12, minHeight: 50 },
  inputRowFocused: { borderColor: BRAND_COLORS.primaryBright, backgroundColor: '#FFFFFF' },
  leadIcon: { paddingLeft: 14 },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#101828' },
  toggle: { paddingHorizontal: 14, minHeight: 48, justifyContent: 'center' },
  toggleText: { fontSize: 13, fontWeight: '700', color: BRAND_COLORS.primaryRoyal },
  errorBox: { backgroundColor: BRAND_COLORS.errorLight, borderWidth: 1, borderColor: '#FECDCA', borderRadius: 10, padding: 12, marginBottom: 14 },
  errorText: { color: BRAND_COLORS.error, fontSize: 13, lineHeight: 18 },
  button: { backgroundColor: BRAND_COLORS.primary, borderRadius: 12, minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonBusy: { opacity: 0.75 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  waking: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: BRAND_COLORS.warningLight, borderRadius: 10, padding: 10, marginBottom: 14 },
  wakingText: { flex: 1, fontSize: 12, color: BRAND_COLORS.warning },
});
