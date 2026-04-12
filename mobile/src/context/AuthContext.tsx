import React, { createContext, useContext, useEffect, useState } from 'react';
import { getStoredAuth, logout as logoutService } from '../services/authService';
import { getShopInfo } from '../utils/storage';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthState = {
  /** false while AsyncStorage is being read on app launch — prevents flash of wrong screen */
  isReady: boolean;
  /** true if a valid (non-expired) JWT is present in AsyncStorage */
  isAuthenticated: boolean;
  /** true if shop setup has been completed and shop info is saved */
  isShopSetup: boolean;
  /** false when admin has deactivated this shop via the backend */
  isShopActive: boolean;
  /** Phone number decoded from JWT — available after login */
  phone: string | null;
  /** Call after successful OTP verification */
  login: (phone: string) => Promise<void>;
  /** Call after ShopSetup form is completed */
  completeSetup: () => void;
  /** Clears token + shop info and returns to login */
  logout: () => Promise<void>;
  /** Called by syncService when it detects is_active = false from backend */
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

  // On mount: check for a persisted JWT, shop info, and active status
  useEffect(() => {
    getStoredAuth()
      .then(async ({ isAuthenticated: authed, isShopSetup: shopReady, phone: p }) => {
        setIsAuthenticated(authed);
        setIsShopSetup(shopReady);
        setPhone(p);

        if (shopReady) {
          const info = await getShopInfo();
          // Default true — backwards-compatible with installs before isActive was added
          setIsShopActive(info?.isActive ?? true);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
        setIsShopSetup(false);
        setPhone(null);
      })
      .finally(() => setIsReady(true));
  }, []);

  const login = async (p: string) => {
    setIsAuthenticated(true);
    setPhone(p);

    // JWT is now in AsyncStorage — re-run the full auth check so that
    // returning users (or reinstalled app) skip ShopSetup if shop already exists
    const { isShopSetup: shopReady } = await getStoredAuth();
    if (shopReady) {
      const info = await getShopInfo();
      setIsShopSetup(true);
      setIsShopActive(info?.isActive ?? true);
    }
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
