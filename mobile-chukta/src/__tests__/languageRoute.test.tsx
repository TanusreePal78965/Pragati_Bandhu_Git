import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { i18n, initI18n } from '../i18n';
import { LanguageRoute } from '../screens/LanguageScreen';
import { makeSession, OWNER, renderScreen } from './helpers/session';

beforeAll(() => initI18n('en'));

test('changing language pops the screen immediately; the language change lands after the pop settles', async () => {
  const s = await makeSession(OWNER);
  renderScreen('Language', LanguageRoute, s);
  fireEvent.press(await screen.findByTestId('lang-bn'));
  // The pop happens synchronously on press, before the deferred language change runs — this
  // ordering is what avoids racing react-native-screens' fragment removal (see LanguageScreen.tsx).
  expect((await screen.findByTestId('current-route')).props.children).toBe('Tabs');
  await waitFor(() => expect(i18n.language).toBe('bn'));
});
