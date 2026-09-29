import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { getAppVersionCode, getAppVersion } from '../lib/version';

interface VersionState {
  isForceUpdate: boolean;
  isSoftUpdate: boolean;
  isMaintenance: boolean;
  maintenanceMessage: string;
  updateTitle: string;
  updateMessage: string;
  storeUrl: string;
  currentVersion: string;
  expectedVersion: string;
  currentVersionCode: number;
  expectedVersionCode: number;
  checkVersion: () => Promise<void>;
  dismissSoftUpdate: () => void;
  setMaintenance: (active: boolean, message?: string) => void;
  setForceUpdate: (active: boolean, title?: string, message?: string, storeUrl?: string, currentVersion?: string, expectedVersion?: string, currentVersionCode?: number, expectedVersionCode?: number) => void;
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
  const [currentVersion, setCurrentVersion] = useState('');
  const [expectedVersion, setExpectedVersion] = useState('');
  const [currentVersionCode, setCurrentVersionCode] = useState(0);
  const [expectedVersionCode, setExpectedVersionCode] = useState(0);

  const setMaintenance = useCallback((active: boolean, message = '') => {
    setIsMaintenance(active);
    if (message) setMaintenanceMessage(message);
  }, []);

  const setForceUpdate = useCallback((active: boolean, title = '', message = '', url = '', current = '', expected = '', currentCode = 0, expectedCode = 0) => {
    setIsForceUpdate(active);
    if (title) setUpdateTitle(title);
    if (message) setUpdateMessage(message);
    if (url) setStoreUrl(url);
    if (current) setCurrentVersion(current);
    if (expected) setExpectedVersion(expected);
    if (currentCode > 0) setCurrentVersionCode(currentCode);
    if (expectedCode > 0) setExpectedVersionCode(expectedCode);
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
        setCurrentVersion(getAppVersion());
        setExpectedVersion(map['app_min_version'] || '1.0.0');
        setCurrentVersionCode(currentCode);
        setExpectedVersionCode(minVersionCode);
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
        currentVersion,
        expectedVersion,
        currentVersionCode,
        expectedVersionCode,
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
