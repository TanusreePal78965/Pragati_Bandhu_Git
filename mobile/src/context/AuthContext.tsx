import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getStoredAuth, logout as logoutService } from '../services/authService';
import { getShopInfo, getOrCreateDeviceId } from '../utils/storage';
import { startSyncService, stopSyncService } from '../services/syncService';
import { onRestoreEvent } from '../utils/restoreEvents';

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
  /** true when another device has claimed this shop's active session */
  isDeviceConflict: boolean;
  /** true while a background auto-restore from Supabase is in progress (C11) */
  isAutoRestoring: boolean;
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
  /** Claims the session for this device — updates active_device_id in Supabase */
  claimSession: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isShopSetup, setIsShopSetup] = useState(false);
  const [isShopActive, setIsShopActive] = useState(true);
  const [isDeviceConflict, setIsDeviceConflict] = useState(false);
  const [isAutoRestoring, setIsAutoRestoring] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);

  // C11: Subscribe to auto-restore lifecycle events emitted by authService.
  // Must be registered BEFORE the auth check effect runs so the 'start' event
  // is not missed. Effects run in declaration order.
  useEffect(() => {
    onRestoreEvent((event) => {
      setIsAutoRestoring(event === 'start');
    });
    return () => onRestoreEvent(null);
  }, []);

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
          await startSyncService(
            () => setShopActive(false),
            () => setIsDeviceConflict(true),
          );
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
          setIsDeviceConflict(false);
          setPhone(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (p: string) => {
    const { isShopSetup: shopReady } = await getStoredAuth();
    const info = shopReady ? await getShopInfo() : null;

    setPhone(p);
    setIsAuthenticated(true);
    setIsShopSetup(shopReady);
    setIsShopActive(info?.isActive ?? true);
    setIsDeviceConflict(false);
    if (shopReady) {
      await startSyncService(
        () => setShopActive(false),
        () => setIsDeviceConflict(true),
      );
    }
  };

  const completeSetup = () => {
    setIsShopSetup(true);
    setIsShopActive(true);
    setIsDeviceConflict(false);
    startSyncService(
      () => setShopActive(false),
      () => setIsDeviceConflict(true),
    );
  };

  const logout = async () => {
    stopSyncService();
    await logoutService();
    setIsAuthenticated(false);
    setIsShopSetup(false);
    setIsShopActive(true);
    setIsDeviceConflict(false);
    setPhone(null);
  };

  const setShopActive = (active: boolean) => {
    setIsShopActive(active);
  };

  /**
   * Claims this device as the active session by writing its device_id to
   * Supabase. The conflicting device will detect the mismatch on its next
   * foreground and be shown the DeviceConflictScreen.
   */
  const claimSession = async (): Promise<void> => {
    try {
      const deviceId = await getOrCreateDeviceId();
      const { data: { session } } = await supabase.auth.getSession();
      const shopPhone = session?.user?.phone?.slice(-10);
      if (shopPhone) {
        await supabase.from('shops')
          .update({ active_device_id: deviceId })
          .eq('id', shopPhone);
      }
    } catch {
      // Non-critical — conflict screen will retry on next foreground
    }
    setIsDeviceConflict(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isReady,
        isAuthenticated,
        isShopSetup,
        isShopActive,
        isDeviceConflict,
        isAutoRestoring,
        phone,
        login,
        completeSetup,
        logout,
        setShopActive,
        claimSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = () => useContext(AuthContext);
