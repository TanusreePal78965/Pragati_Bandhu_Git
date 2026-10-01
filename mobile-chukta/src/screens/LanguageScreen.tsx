import { useNavigation } from '@react-navigation/native';
import { InteractionManager, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { initI18n, setLanguage, type Language } from '../i18n';
import { useT } from '../i18n/useT';
import { Button, Card, Screen, ScreenHeader } from '../ui/components';
import { colors, radius, shadows, space } from '../ui/theme';

const LANGUAGES: { code: Language; native: string; subtitle: string }[] = [
  { code: 'en', native: 'English', subtitle: 'Default' },
  { code: 'bn', native: 'বাংলা', subtitle: 'Bengali' },
  { code: 'hi', native: 'हिन्दी', subtitle: 'Hindi' },
];

// Rendered both inside the navigator (LanguageRoute, from Settings) and before it exists (AppRoot's
// first-run picker), so it must not touch navigation itself — the caller passes onBack when there is one.
export function LanguageScreen({
  onChosen,
  onBack,
}: {
  onChosen: (lang: Language) => void | Promise<void>;
  onBack?: () => void;
}) {
  const t = useT();

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScreenHeader
        title={t('language.title')}
        showBack={!!onBack}
        onBack={onBack}
      />
      <Screen>
        <Card style={styles.card}>
          <Text style={styles.heading}>{t('language.title')}</Text>
          <View style={styles.list}>
            {LANGUAGES.map((item) => (
              <View key={item.code} style={styles.itemWrap}>
                <Button
                  kind="secondary"
                  title={`${item.native} (${item.subtitle})`}
                  onPress={() => void onChosen(item.code)}
                  testID={`lang-${item.code}`}
                />
              </View>
            ))}
          </View>
        </Card>
      </Screen>
    </SafeAreaView>
  );
}

/** In-session route (Settings → Language). */
export function LanguageRoute() {
  const navigation = useNavigation();
  return (
    <LanguageScreen
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      onChosen={(l) => {
        navigation.goBack();
        InteractionManager.runAfterInteractions(() => {
          void (async () => {
            try {
              await setLanguage(l);
            } catch {
              await initI18n(l).catch(() => {});
            }
          })();
        });
      }}
    />
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  card: {
    padding: space.lg,
    gap: space.md,
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  list: {
    gap: space.sm,
  },
  itemWrap: {
    width: '100%',
  },
});
