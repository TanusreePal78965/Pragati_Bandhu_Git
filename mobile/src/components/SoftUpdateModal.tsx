import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

interface Props {
  visible: boolean;
  title?: string;
  message?: string;
  storeUrl?: string;
  onDismiss: () => void;
}

export function SoftUpdateModal({
  visible,
  title = 'New Version Available',
  message = 'A new update for Pragati Bandhu is available with performance improvements and new features.',
  storeUrl,
  onDismiss,
}: Props) {
  const handleUpdate = () => {
    if (storeUrl) {
      Linking.openURL(storeUrl).catch(() => {});
    }
    onDismiss();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconBadge}>
            <Ionicons name="sparkles" size={32} color={colors.primary} />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.dismissButton} onPress={onDismiss} activeOpacity={0.7}>
              <Text style={styles.dismissText}>Later</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.updateButton} onPress={handleUpdate} activeOpacity={0.8}>
              <Text style={styles.updateText}>Update Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  dismissButton: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  updateButton: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
