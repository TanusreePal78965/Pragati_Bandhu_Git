import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getStoredAuth, logout as logoutService } from '../services/authService';
import { getShopInfo } from '../utils/storage';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthState = {
  /** false while session is being read on app launch — prevents flash of wrong screen */
  isReady: boolean;
  /** true if a valid Supabase session exists */
  isAuthenticated: boolean;
  /** true if shop setup has been completed and shop info is saved */
  isShopSetup: boolean;
  /** false when admin has deactivated this shop */
  isShopActive: boolean;
  /** 10-digit phone number — available after login */
  phone: string | null;
  /** Call after successful OTP verification */
  login: (phone: string) => Promise<void>;
  /** Call after ShopSetup form is completed */
  completeSetup: () => void;
  /** Clears Supabase session + shop info and returns to login */
  logout: () => Promise<void>;
  /** Called by syncService when it detects is_active = false */
  setShopActive: (active: boolean) => void;
};

const AuthContext = createContext<AuthState>({} as AuthState);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isShopSetup, setIsShopSetup] = useState(false);
  const [isShopActive, setIsShopActive] = useState(true);
  const [phone, setPhone] = useState<string | null>(null);

  // On mount: restore session from Supabase (persisted in AsyncStorage)
  useEffect(() => {
    getStoredAuth()
      .then(async ({ isAuthenticated: authed, isShopSetup: shopReady, phone: p }) => {
        setIsAuthenticated(authed);
        setIsShopSetup(shopReady);
        setPhone(p);

        if (shopReady) {
          const info = await getShopInfo();
          setIsShopActive(info?.isActive ?? true);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        setIsShopSetup(false);
        setPhone(null);
      })
      .finally(() => setIsReady(true));

    // Listen for Supabase auth state changes (token refresh, sign-out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT' || !session) {
          setIsAuthenticated(false);
          setIsShopSetup(false);
          setIsShopActive(true);
          setPhone(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (p: string) => {
    // Run full auth check first, then set all state at once to avoid
    // briefly flashing ShopSetup for returning users
    const { isShopSetup: shopReady } = await getStoredAuth();
    const info = shopReady ? await getShopInfo() : null;

    setPhone(p);
    setIsAuthenticated(true);
    setIsShopSetup(shopReady);
    setIsShopActive(info?.isActive ?? true);
  };

  const completeSetup = () => {
    setIsShopSetup(true);
    setIsShopActive(true);
  };

  const logout = async () => {
    await logoutService();
    setIsAuthenticated(false);
    setIsShopSetup(false);
    setIsShopActive(true);
    setPhone(null);
  };

  const setShopActive = (active: boolean) => {
    setIsShopActive(active);
  };

  return (
    <AuthContext.Provider
      value={{ isReady, isAuthenticated, isShopSetup, isShopActive, phone, login, completeSetup, logout, setShopActive }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = () => useContext(AuthContext);
