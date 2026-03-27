import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch, Share, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../store/authStore';
import ScreenContainer from '../components/ScreenContainer';
import { theme, styles as themeStyles } from '../theme';

const APP_VERSION = '1.0.0';
const APPLE_STORE_URL = 'https://apps.apple.com/app/courtwatch/id123456789';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.courtwatch.app';

export default function SettingsScreen() {
  const { logout, user } = useAuthStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

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

  const handleShare = async () => {
    try {
      await Share.share({
        message: 'Check out CourtWatch - Find tennis courts in the GTA area! https://apps.apple.com/app/courtwatch/id123456789',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share the app');
    }
  };

  const handleRate = async () => {
    const url = Platform.OS === 'ios' ? APPLE_STORE_URL : PLAY_STORE_URL;
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Error', 'Failed to open app store');
    }
  };

  return (
    <ScreenContainer>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email || 'Not logged in'}</Text>
        </View>

        <View style={styles.toggleCard}>
          <View style={styles.rowLeft}>
            <Ionicons name="notifications-outline" size={22} color={theme.colors.text} />
            <Text style={styles.rowText}>Notifications</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: '#767577', true: theme.colors.primaryLight }}
            thumbColor={notificationsEnabled ? theme.colors.primary : '#f4f3f4'}
          />
        </View>

        <View style={styles.toggleCard}>
          <View style={styles.rowLeft}>
            <Ionicons name="location-outline" size={22} color={theme.colors.text} />
            <Text style={styles.rowText}>Location Services</Text>
          </View>
          <Switch
            value={locationEnabled}
            onValueChange={setLocationEnabled}
            trackColor={{ false: '#767577', true: theme.colors.primaryLight }}
            thumbColor={locationEnabled ? theme.colors.primary : '#f4f3f4'}
          />
        </View>

        <TouchableOpacity style={styles.rowCard} onPress={handleRate}>
          <View style={styles.rowLeft}>
            <Ionicons name="star-outline" size={22} color={theme.colors.text} />
            <Text style={styles.rowText}>Rate the App</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.rowCard} onPress={handleShare}>
          <View style={styles.rowLeft}>
            <Ionicons name="share-outline" size={22} color={theme.colors.text} />
            <Text style={styles.rowText}>Share the App</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.label}>Version</Text>
          <Text style={styles.value}>{APP_VERSION}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>About</Text>
          <Text style={styles.value}>CourtWatch helps you find tennis courts in the GTA area. Check court availability, save your favorites, and get notified when courts become available.{'\n\n'}
Court status is for reference only.{'\n\n'}
<Text style={styles.aboutItalic}>Help each other and save our time to find a perfect court!{'\n'}
Have fun!</Text></Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  rowCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 6,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowText: {
    fontSize: 16,
    color: theme.colors.text,
    marginLeft: 12,
  },
  rowValue: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginRight: 4,
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
  aboutItalic: {
    fontSize: 16,
    fontStyle: 'italic',
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