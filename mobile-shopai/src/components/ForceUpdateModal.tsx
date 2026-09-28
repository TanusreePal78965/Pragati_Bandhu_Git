import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Linking,
  BackHandler,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

interface Props {
  visible: boolean;
  title?: string;
  message?: string;
  storeUrl?: string;
  currentVersion?: string;
  expectedVersion?: string;
  currentVersionCode?: number;
  expectedVersionCode?: number;
}

export function ForceUpdateModal({
  visible,
  title = 'Update Required',
  message = 'A mandatory update is required to continue using Pragati Bandhu.',
  storeUrl,
  currentVersion,
  expectedVersion,
  currentVersionCode,
  expectedVersionCode,
}: Props) {
  // Lock Android Hardware Back Press when modal is visible
  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [visible]);

  const handleUpdate = () => {
    if (storeUrl) {
      Linking.openURL(storeUrl).catch(() => {
        // Fallback to web browser if market:// protocol fails
      });
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          {(currentVersion || expectedVersion) && (
            <View style={styles.versionContainer}>
              {currentVersion && (
                <Text style={styles.versionText}>
                  Current Version: <Text style={styles.versionValue}>{currentVersion} {currentVersionCode ? `(${currentVersionCode})` : ''}</Text>
                </Text>
              )}
              {expectedVersion && (
                <Text style={styles.versionText}>
                  Expected Version: <Text style={styles.versionValue}>{expectedVersion} {expectedVersionCode ? `(${expectedVersionCode})` : ''}</Text>
                </Text>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={handleUpdate} activeOpacity={0.8}>
            <Ionicons name="download-outline" size={22} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>Update Now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 360,
  },
  iconContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 72,
    height: 72,
    borderRadius: 18,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  versionContainer: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    width: '100%',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  versionText: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  versionValue: {
    fontWeight: '600',
    color: colors.text,
  },
  button: {
    width: '100%',
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
