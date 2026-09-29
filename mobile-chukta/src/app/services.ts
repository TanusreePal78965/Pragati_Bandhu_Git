import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { createStaffApi } from '../api/staffApi';
import { createAuthDeps } from '../auth/authDeps';
import { createAuthService } from '../auth/authService';
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '../lib/supabase';

export const authService = createAuthService(createAuthDeps({
  client: supabase, storage: AsyncStorage, supabaseUrl: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, newId: () => Crypto.randomUUID(),
}));

export const staffApi = createStaffApi({
  supabaseUrl: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  accessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
});
