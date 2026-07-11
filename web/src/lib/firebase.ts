import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

// Lazy — getAuth() throws synchronously on an invalid/missing apiKey, so this
// must not run at module-import time (it would crash the whole page before
// React mounts if the Firebase Web app config hasn't been set up yet).
export function getFirebaseAuth(): Auth {
  if (!auth) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
  }
  return auth;
}
