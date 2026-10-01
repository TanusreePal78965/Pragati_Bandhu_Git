import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authService } from '../app/services';
import { AuthError, type AuthErrorKey } from '../auth/authService';
import type { Identity } from '../auth/identity';
import { FORGOT_PASSWORD_URL, REGISTER_URL } from '../config';
import { useT } from '../i18n/useT';
import { Button, Card, ErrorText, Field, HeroCard, Muted, Screen, Segmented, Title } from '../ui/components';
import { Icon } from '../ui/Icon';
import { colors, radius, shadows, space } from '../ui/theme';

type Mode = 'owner' | 'staff';

export function LoginScreen({
  notice,
  onLoggedIn,
}: {
  notice: string | null;
  onLoggedIn: (identity: Identity) => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<Mode>('owner');
  const [phone, setPhone] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const valid =
    /^\d{10}$/.test(phone) && (mode === 'owner' ? secret.length > 0 : /^\d{4}$/.test(secret));

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const identity =
        mode === 'owner'
          ? await authService.loginOwner(phone, secret)
          : await authService.loginStaff(phone, secret);
      onLoggedIn(identity);
    } catch (e) {
      setError(e instanceof AuthError ? e.key : 'auth.error.unknown');
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Screen>
        {/* Brand Hero Card */}
        <HeroCard variant="soft" style={styles.hero}>
          <View style={styles.logoBadge}>
            <Icon name="wallet-outline" size={32} color={colors.primaryDark} />
          </View>
          <View style={styles.heroText}>
            <Title style={styles.appName}>{t('common.appName')}</Title>
            <Text style={styles.tagline}>Worker Pay, Advance & Attendance</Text>
          </View>
        </HeroCard>

        {notice ? (
          <Card style={styles.noticeCard}>
            <Icon name="alert-circle-outline" size={18} color={colors.warning} />
            <Muted style={styles.noticeText}>{t(notice)}</Muted>
          </Card>
        ) : null}

        {/* Form Card */}
        <Card style={styles.formCard}>
          <Segmented
            options={[
              { value: 'owner' as Mode, label: t('auth.login.owner') },
              { value: 'staff' as Mode, label: t('auth.login.staff') },
            ]}
            value={mode}
            onChange={(m) => {
              setMode(m);
              setSecret('');
              setError(null);
            }}
            testIDPrefix="mode"
          />

          <Field
            label={t(mode === 'owner' ? 'auth.login.phone' : 'auth.login.ownerPhone')}
            value={phone}
            onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
            keyboardType="phone-pad"
            placeholder="10-digit mobile number"
            testID="phone"
          />

          {mode === 'owner' ? (
            <Field
              label={t('auth.login.password')}
              value={secret}
              onChangeText={setSecret}
              secureTextEntry
              autoCapitalize="none"
              placeholder="Password"
              testID="secret"
            />
          ) : (
            <Field
              label={t('auth.login.pin')}
              value={secret}
              onChangeText={(v) => setSecret(v.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              secureTextEntry
              placeholder="4 digit PIN"
              testID="secret"
            />
          )}

          <ErrorText>{error ? t(error) : null}</ErrorText>

          <Button
            title={t('auth.login.submit')}
            onPress={() => void submit()}
            disabled={!valid}
            loading={busy}
            testID="submit"
          />
        </Card>

        {mode === 'owner' ? (
          <View style={styles.extraLinks}>
            <Button
              kind="secondary"
              title={t('auth.login.forgot')}
              onPress={() => void Linking.openURL(FORGOT_PASSWORD_URL)}
              testID="forgot"
            />
            <Button
              kind="secondary"
              title={t('auth.login.register')}
              onPress={() => void Linking.openURL(REGISTER_URL)}
              testID="register"
            />
          </View>
        ) : null}
      </Screen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.lg,
    gap: space.md,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    ...shadows.sm,
  },
  heroText: {
    flex: 1,
    justifyContent: 'center',
  },
  appName: {
    fontSize: 24,
    color: colors.primaryDark,
  },
  tagline: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
    fontWeight: '500',
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.warnSoft,
    borderColor: colors.warnBorder,
  },
  noticeText: {
    color: colors.warnText,
    flex: 1,
    fontWeight: '500',
  },
  formCard: {
    gap: space.md,
  },
  extraLinks: {
    gap: space.sm,
    marginTop: space.xs,
  },
});
