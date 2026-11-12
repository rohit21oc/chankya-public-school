import React, { useState } from 'react';
import { View } from 'react-native';
import { apiService } from '../services/apiService';
import { User } from '../types';
import { LoginField, LoginError, SignInButton, WakingNotice } from './LoginFields';

interface Props {
  onLoginSuccess: (user: User) => void;
  isWakingUp?: boolean;
}

export const StaffLoginForm: React.FC<Props> = ({ onLoginSuccess, isWakingUp = false }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (loading) return;
    const id = identifier.trim();
    if (!id) return setError('Enter your Login ID.');
    if (!password) return setError('Enter your password.');
    setError(null);
    setLoading(true);
    try {
      const r = await apiService.loginStaff(id, password, true);
      if (r.success && r.user) onLoginSuccess(r.user);
      else setError(r.error || 'Sign in failed. Check your Login ID and password.');
    } catch {
      setError('Could not reach the school server. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <LoginField icon="user" label="Login ID" value={identifier} onChangeText={(t) => { setIdentifier(t); setError(null); }} placeholder="Employee ID or username" editable={!loading} returnKeyType="next" />
      <LoginField label="Password" value={password} onChangeText={(t) => { setPassword(t); setError(null); }} placeholder="Password" secure editable={!loading} returnKeyType="go" onSubmitEditing={submit} />
      <WakingNotice show={isWakingUp} />
      <LoginError message={error} />
      <SignInButton loading={loading} onPress={submit} />
    </View>
  );
};
