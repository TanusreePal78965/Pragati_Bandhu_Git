import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setLanguage, type Language } from '../i18n';
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
  return <LanguageScreen onChosen={async (l) => { await setLanguage(l); navigation.goBack(); }} />;
}
