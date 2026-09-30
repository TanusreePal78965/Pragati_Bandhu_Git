import { useNavigation } from '@react-navigation/native';
import { InteractionManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { initI18n, setLanguage, type Language } from '../i18n';
import { useT } from '../i18n/useT';
import { Button, Screen, Title } from '../ui/components';
import { colors } from '../ui/theme';

const LANGUAGES: Language[] = ['en', 'bn', 'hi'];

export function LanguageScreen({ onChosen }: { onChosen: (lang: Language) => void | Promise<void> }) {
  const t = useT();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <Title>{t('language.title')}</Title>
        {LANGUAGES.map((l) => (
          <Button key={l} kind="secondary" title={t(`language.${l}`)} onPress={() => void onChosen(l)} testID={`lang-${l}`} />
        ))}
      </Screen>
    </SafeAreaView>
  );
}

/** In-session route (Settings → Language). */
export function LanguageRoute() {
  const navigation = useNavigation();
  return (
    <LanguageScreen
      onChosen={(l) => {
        // Pop first. Changing the language re-renders every mounted screen's header (translated
        // titles), and doing that while this screen's native fragment is still being removed from
        // the stack races react-native-screens ("ScreenStackFragment added into a non-stack
        // container"). Deferring the change to after the pop's interactions finish avoids it.
        navigation.goBack();
        InteractionManager.runAfterInteractions(() => {
          void (async () => {
            try {
              await setLanguage(l);
            } catch {
              // Saving the choice for next launch failed (e.g. storage write error); still switch
              // the app's language now, so the tap isn't silently lost.
              await initI18n(l).catch(() => {});
            }
          })();
        });
      }}
    />
  );
}
