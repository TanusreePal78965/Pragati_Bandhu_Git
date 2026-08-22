import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { getAppVersionCode } from '../lib/version';

interface VersionState {
  isForceUpdate: boolean;
  isSoftUpdate: boolean;
  isMaintenance: boolean;
  maintenanceMessage: string;
  updateTitle: string;
  updateMessage: string;
  storeUrl: string;
  checkVersion: () => Promise<void>;
  dismissSoftUpdate: () => void;
  setMaintenance: (active: boolean, message?: string) => void;
  setForceUpdate: (active: boolean, title?: string, message?: string, storeUrl?: string) => void;
}

const VersionContext = createContext<VersionState>({} as VersionState);

export function VersionProvider({ children }: { children: React.ReactNode }) {
  const [isForceUpdate, setIsForceUpdate] = useState(false);
  const [isSoftUpdate, setIsSoftUpdate] = useState(false);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');
  const [storeUrl, setStoreUrl] = useState('');

  const setMaintenance = useCallback((active: boolean, message = '') => {
    setIsMaintenance(active);
    if (message) setMaintenanceMessage(message);
  }, []);

  const setForceUpdate = useCallback((active: boolean, title = '', message = '', url = '') => {
    setIsForceUpdate(active);
    if (title) setUpdateTitle(title);
    if (message) setUpdateMessage(message);
    if (url) setStoreUrl(url);
  }, []);

  const dismissSoftUpdate = useCallback(() => {
    setIsSoftUpdate(false);
  }, []);

  const checkVersion = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value');

      if (error || !data) return;

      const map: Record<string, string> = {};
      data.forEach((row) => {
        if (row.key && row.value !== null) {
          map[row.key] = row.value;
        }
      });

      const isMaint = map['app_maintenance_mode'] === '1' || map['app_maintenance_mode'] === 'true';
      const minVersionCode = parseInt(map['app_min_version_code'] || '1', 10);
      const latestVersionCode = parseInt(map['app_latest_version_code'] || '1', 10);
      const currentCode = getAppVersionCode();

      const targetStoreUrl =
        Platform.OS === 'android'
          ? map['app_play_store_url'] || 'https://play.google.com/store/apps/details?id=com.pragatibandhu.app'
          : map['app_app_store_url'] || 'https://apps.apple.com/app/id6400000000';

      // 1. Maintenance Check
      if (isMaint) {
        setIsMaintenance(true);
        setMaintenanceMessage(
          map['app_maintenance_message'] || 'App is currently undergoing maintenance.'
        );
        return;
      } else {
        setIsMaintenance(false);
      }

      // 2. Force Update Check (build code < min_version_code)
      if (currentCode < minVersionCode) {
        setIsForceUpdate(true);
        setUpdateTitle(map['app_force_update_title'] || 'Update Required');
        setUpdateMessage(map['app_force_update_message'] || 'Please update your app to continue.');
        setStoreUrl(targetStoreUrl);
        return;
      } else {
        setIsForceUpdate(false);
      }

      // 3. Soft Update Check (build code < latest_version_code)
      if (currentCode < latestVersionCode) {
        setIsSoftUpdate(true);
        setUpdateTitle(map['app_soft_update_title'] || 'New Version Available');
        setUpdateMessage(map['app_soft_update_message'] || 'New update available with new features.');
        setStoreUrl(targetStoreUrl);
      }
    } catch (e) {
      // Ignore network errors during version check
    }
  }, []);

  return (
    <VersionContext.Provider
      value={{
        isForceUpdate,
        isSoftUpdate,
        isMaintenance,
        maintenanceMessage,
        updateTitle,
        updateMessage,
        storeUrl,
        checkVersion,
        dismissSoftUpdate,
        setMaintenance,
        setForceUpdate,
      }}
    >
      {children}
    </VersionContext.Provider>
  );
}

export function useVersion() {
  return useContext(VersionContext);
}
