import React, { createContext, useContext, useEffect, useState } from 'react';
import { getStoredAuth, logout as logoutService } from '../services/authService';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthState = {
  /** false while AsyncStorage is being read on app launch — prevents flash of wrong screen */
  isReady: boolean;
  /** true if a valid (non-expired) JWT is present in AsyncStorage */
  isAuthenticated: boolean;
  /** true if shop setup has been completed and shop info is saved */
  isShopSetup: boolean;
  /** Call after successful OTP verification */
  login: () => void;
  /** Call after ShopSetup form is completed */
  completeSetup: () => void;
  /** Clears token + shop info and returns to login */
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isShopSetup, setIsShopSetup] = useState(false);

  // On mount: check for a persisted JWT and shop info
  useEffect(() => {
    getStoredAuth()
      .then(({ isAuthenticated: authed, isShopSetup: shopReady }) => {
        setIsAuthenticated(authed);
        setIsShopSetup(shopReady);
      })
      .catch(() => {
        // Any storage error → treat as logged out
        setIsAuthenticated(false);
        setIsShopSetup(false);
      })
      .finally(() => setIsReady(true));
  }, []);

  const login = () => setIsAuthenticated(true);
  const completeSetup = () => setIsShopSetup(true);

  const logout = async () => {
    await logoutService();
    setIsAuthenticated(false);
    setIsShopSetup(false);
  };

  return (
    <AuthContext.Provider
      value={{ isReady, isAuthenticated, isShopSetup, login, completeSetup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = () => useContext(AuthContext);
