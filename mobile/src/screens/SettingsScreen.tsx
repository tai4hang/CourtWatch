import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuthStore } from '../store/authStore';
import ScreenContainer from '../components/ScreenContainer';
import { theme, styles as themeStyles } from '../theme';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  const { logout, user } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: () => logout()},
      ]
    );
  };

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email || 'Not logged in'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Version</Text>
          <Text style={styles.value}>{APP_VERSION}</Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
  },
  label: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: theme.colors.text,
  },
  logoutButton: {
    backgroundColor: theme.colors.error,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});