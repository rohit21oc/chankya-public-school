import React, { useState } from 'react';
import { View } from 'react-native';
import { apiService } from '../services/apiService';
import { User } from '../types';
import { formatDobInput } from '../utils/dobInput';
import { LoginField, LoginError, SignInButton, WakingNotice } from './LoginFields';

interface Props {
  onLoginSuccess: (user: User) => void;
  isWakingUp?: boolean;
}

export const StudentLoginForm: React.FC<Props> = ({ onLoginSuccess, isWakingUp = false }) => {
  const [admission, setAdmission] = useState('');
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (loading) return;
    const adm = admission.trim();
    const pw = dob.trim();
    if (!adm) return setError('Enter your Roll Number or Admission Number.');
    if (!pw) return setError('Enter your date of birth as DD-MM-YYYY.');
    setError(null);
    setLoading(true);
    try {
      const r = await apiService.loginStudent(adm, pw, true);
      if (r.success && r.user) onLoginSuccess(r.user);
      else setError(r.error || 'Login failed. Check your Roll Number / Admission Number and date of birth.');
    } catch {
      setError('Could not reach the school server. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <LoginField icon="user" label="Roll Number / Admission No." value={admission} onChangeText={(t) => { setAdmission(t); setError(null); }} placeholder="Enter your roll number or admission no." autoCapitalize="characters" editable={!loading} returnKeyType="next" />
      <LoginField icon="calendar" label="Date of Birth" value={dob} onChangeText={(t) => { setDob(formatDobInput(t)); setError(null); }} placeholder="DD-MM-YYYY" keyboardType="number-pad" maxLength={20} editable={!loading} returnKeyType="go" onSubmitEditing={submit} />
      <WakingNotice show={isWakingUp} />
      <LoginError message={error} />
      <SignInButton loading={loading} onPress={submit} />
    </View>
  );
};
