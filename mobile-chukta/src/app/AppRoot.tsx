import { getLocales } from 'expo-localization';
import { useCallback, useEffect, useState } from 'react';
import type { Identity } from '../auth/identity';
import { getStoredLanguage, initI18n, setLanguage, type Language } from '../i18n';
import { LanguageScreen } from '../screens/LanguageScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { Loading } from '../ui/components';
import { SessionNavigator } from './navigation';
import { authService } from './services';
import { SessionProvider, type LogoutReason } from './SessionProvider';

function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return code === 'bn' || code === 'hi' ? code : 'en';
}

type Phase =
  | { name: 'boot' }
  | { name: 'language' }
  | { name: 'login'; notice: string | null }
  | { name: 'session'; identity: Identity };

export default function AppRoot() {
  const [phase, setPhase] = useState<Phase>({ name: 'boot' });

  const restore = useCallback(async () => {
    const identity = await authService.restore();
    setPhase(identity ? { name: 'session', identity } : { name: 'login', notice: null });
  }, []);

  useEffect(() => {
    (async () => {
      const lang = await getStoredLanguage();
      if (!lang) {
        await initI18n(deviceLanguage());
        setPhase({ name: 'language' });
        return;
      }
      await initI18n(lang);
      await restore();
    })().catch(() => setPhase({ name: 'login', notice: null }));
  }, [restore]);

  const onLoggedOut = useCallback((reason: LogoutReason) => {
    void (async () => {
      // A revoked session leaves the identity and stored tokens behind; clear them. A user logout already did.
      if (reason === 'revoked') await authService.logout();
      setPhase({ name: 'login', notice: reason === 'revoked' ? 'auth.login.sessionEnded' : null });
    })();
  }, []);

  switch (phase.name) {
    case 'boot':
      return <Loading />;
    case 'language':
      return <LanguageScreen onChosen={async (l) => { await setLanguage(l); await restore(); }} />;
    case 'login':
      return <LoginScreen notice={phase.notice} onLoggedIn={(identity) => setPhase({ name: 'session', identity })} />;
    case 'session':
      return (
        <SessionProvider key={phase.identity.userId} identity={phase.identity} onLoggedOut={onLoggedOut}>
          <SessionNavigator />
        </SessionProvider>
      );
  }
}
