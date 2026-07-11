import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { login as loginService, getStoredAuth, logout as logoutService } from '../services/authService';
import { getShopInfo, getOrCreateDeviceId, getStoredShopId } from '../utils/storage';
import { startSyncService, stopSyncService } from '../services/syncService';
import { onRestoreEvent } from '../utils/restoreEvents';

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthState = {
  /** false while stored session is being read on app launch — prevents flash of wrong screen */
  isReady: boolean;
  /** true if a locally stored shop session exists */
  isAuthenticated: boolean;
  /** false when admin has deactivated this shop (or it's pending payment activation) */
  isShopActive: boolean;
  /** true when another device has claimed this shop's active session */
  isDeviceConflict: boolean;
  /** true while a background auto-restore from Supabase is in progress (C11) */
  isAutoRestoring: boolean;
  /** 10-digit phone number — available after login */
  phone: string | null;
  /** Shop UUID — available after login */
  uuid: string | null;
  /** Call with phone + password to log in */
  login: (phone: string, password: string) => Promise<void>;
  /** Clears local session + shop info and returns to login */
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
  const [isShopActive, setIsShopActive] = useState(true);
  const [isDeviceConflict, setIsDeviceConflict] = useState(false);
  const [isAutoRestoring, setIsAutoRestoring] = useState(false);
  const [phone, setPhone] = useState<string | null>(null);
  const [uuid, setUuid] = useState<string | null>(null);

  // C11: Subscribe to auto-restore lifecycle events emitted by authService.
  // Must be registered BEFORE the auth check effect runs so the 'start' event
  // is not missed. Effects run in declaration order.
  useEffect(() => {
    onRestoreEvent((event) => {
      setIsAutoRestoring(event === 'start');
    });
    return () => onRestoreEvent(null);
  }, []);

  // On mount: restore session from local storage.
  useEffect(() => {
    getStoredAuth()
      .then(async ({ isAuthenticated: authed, phone: p, uuid: u }) => {
        setIsAuthenticated(authed);
        setPhone(p);
        setUuid(u);

        if (authed) {
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
        setPhone(null);
        setUuid(null);
      })
      .finally(() => setIsReady(true));
  }, []);

  const login = async (phoneInput: string, password: string) => {
    const shop = await loginService(phoneInput, password);
    setPhone(shop.phone);
    setUuid(shop.id);
    setIsAuthenticated(true);
    setIsShopActive(shop.is_active ?? true);
    setIsDeviceConflict(false);
    await startSyncService(
      () => setShopActive(false),
      () => setIsDeviceConflict(true),
    );
  };

  const logout = async () => {
    stopSyncService();
    await logoutService();
    setIsAuthenticated(false);
    setIsShopActive(true);
    setIsDeviceConflict(false);
    setPhone(null);
    setUuid(null);
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
      const shopId = await getStoredShopId();
      if (shopId) {
        await supabase.from('shops')
          .update({ active_device_id: deviceId })
          .eq('id', shopId);
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
        isShopActive,
        isDeviceConflict,
        isAutoRestoring,
        phone,
        uuid,
        login,
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
