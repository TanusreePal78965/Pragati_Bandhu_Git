import { useState } from 'react';
import { Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authService } from '../app/services';
import { AuthError, type AuthErrorKey } from '../auth/authService';
import type { Identity } from '../auth/identity';
import { FORGOT_PASSWORD_URL, REGISTER_URL } from '../config';
import { useT } from '../i18n/useT';
import { Button, ErrorText, Field, Muted, Screen, Segmented, Title } from '../ui/components';
import { colors } from '../ui/theme';

type Mode = 'owner' | 'staff';

export function LoginScreen({ notice, onLoggedIn }: { notice: string | null; onLoggedIn: (identity: Identity) => void }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>('owner');
  const [phone, setPhone] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = /^\d{10}$/.test(phone) && (mode === 'owner' ? secret.length > 0 : /^\d{4,6}$/.test(secret));

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const identity = mode === 'owner' ? await authService.loginOwner(phone, secret) : await authService.loginStaff(phone, secret);
      onLoggedIn(identity);
    } catch (e) {
      setError(e instanceof AuthError ? e.key : 'auth.error.unknown');
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <Title>{t('common.appName')}</Title>
        {notice ? <Muted>{t(notice)}</Muted> : null}
        <Segmented
          options={[{ value: 'owner' as Mode, label: t('auth.login.owner') }, { value: 'staff' as Mode, label: t('auth.login.staff') }]}
          value={mode}
          onChange={(m) => { setMode(m); setSecret(''); setError(null); }}
          testIDPrefix="mode"
        />
        <Field label={t(mode === 'owner' ? 'auth.login.phone' : 'auth.login.ownerPhone')} value={phone}
          onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" testID="phone" />
        {mode === 'owner' ? (
          <Field label={t('auth.login.password')} value={secret} onChangeText={setSecret} secureTextEntry autoCapitalize="none" testID="secret" />
        ) : (
          <Field label={t('auth.login.pin')} value={secret} onChangeText={(v) => setSecret(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad" secureTextEntry testID="secret" />
        )}
        <ErrorText>{error ? t(error) : null}</ErrorText>
        <Button title={t('auth.login.submit')} onPress={() => void submit()} disabled={!valid} loading={busy} testID="submit" />
        {mode === 'owner' ? (
          <>
            <Button kind="secondary" title={t('auth.login.forgot')} onPress={() => void Linking.openURL(FORGOT_PASSWORD_URL)} testID="forgot" />
            <Button kind="secondary" title={t('auth.login.register')} onPress={() => void Linking.openURL(REGISTER_URL)} testID="register" />
          </>
        ) : null}
      </Screen>
    </SafeAreaView>
  );
}
