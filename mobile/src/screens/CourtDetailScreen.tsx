import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Platform, Modal, Pressable, Alert, RefreshControl } from 'react-native';
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { api } from '../services/api';
import { registerForPushNotifications, subscribeToCourtNotifications, unsubscribeFromCourtNotifications } from '../services/notifications';
import { theme, styles as themeStyles } from '../theme';

type MainStackParamList = {
  CourtDetail: { courtId: string };
};

interface Court {
  id: string;
  name: string;
  address: string;
  city?: string;
  latitude: number;
  longitude: number;
  totalCourts: number;
  courtType: string;
  surface: string;
  hasLights: boolean;
  isFree: boolean;
  status?: 'green' | 'amber' | 'red';
  lastReported?: string;
}

export default function CourtDetailScreen() {
  const route = useRoute<RouteProp<MainStackParamList, 'CourtDetail'>>();
  const navigation = useNavigation();
  const [court, setCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [addingFavorite, setAddingFavorite] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadCourt();
    }, [route.params.courtId])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCourt();
    setRefreshing(false);
  };

  const loadCourt = async () => {
    try {
      const data = await api.getCourt(route.params.courtId);
      setCourt(data.court);
      // Check if already a favorite
      const favData = await api.checkFavorite(route.params.courtId);
      setIsFavorite(favData.isFavorite);
      // Get notification subscriptions count
      const subData = await api.getCourtSubscriptions();
      const subs = subData.subscriptions || [];
      setSubscriptionCount(subs.length);
      setNotificationEnabled(subs.some((s: any) => s.courtId === route.params.courtId));
    } catch (err) {
      console.error('Failed to load court:', err);
      setError('Failed to load court details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFavorite = async () => {
    if (addingFavorite) return;
    setAddingFavorite(true);
    try {
      if (isFavorite) {
        await api.removeFavorite(route.params.courtId);
        setIsFavorite(false);
      } else {
        await api.addFavorite(route.params.courtId);
        setIsFavorite(true);
      }
    } catch (err) {
      console.error('Failed to update favorite:', err);
    } finally {
      setAddingFavorite(false);
    }
  };

  const getStatusColor = (status?: string) => {
    // Map backend status to UI colors
    switch (status) {
      case 'AVAILABLE':
      case 'green':
        return '#4CAF50';
      case 'NOT_AVAILABLE':
      case 'amber':
        return '#FF9800';
      case 'BUSY':
      case 'red':
        return '#F44336';
      case 'CLOSED':
        return '#9E9E9E';
      default:
        return '#9E9E9E';
    }
  };

  const handleNotifyToggle = async () => {
    if (!notificationEnabled) {
      // Check if already at max subscriptions
      if (subscriptionCount >= 3) {
        Alert.alert('Limit Reached', 'You can only subscribe to up to 3 courts for notifications.');
        return;
      }
      // Enable notifications - first register for push, then subscribe
      try {
        await registerForPushNotifications();
        await subscribeToCourtNotifications(route.params.courtId);
        setNotificationEnabled(true);
        setSubscriptionCount(prev => prev + 1);
      } catch (err) {
        console.error('Failed to enable notifications:', err);
        Alert.alert('Error', 'Failed to enable notifications');
      }
    } else {
      // Disable notifications
      try {
        await unsubscribeFromCourtNotifications(route.params.courtId);
        setNotificationEnabled(false);
        setSubscriptionCount(prev => prev - 1);
      } catch (err) {
        console.error('Failed to disable notifications:', err);
      }
    }
  };

  const handleReportStatus = () => {
    setShowStatusModal(true);
  };

  const handleStatusSelect = async (newStatus: string) => {
    setShowStatusModal(false);
    if (!court) return;
    setReporting(true);
    try {
      // Map UI status to backend status
      const statusMap: Record<string, string> = {
        'green': 'AVAILABLE',
        'amber': 'NOT_AVAILABLE',
        'red': 'BUSY',
      };
      const backendStatus = statusMap[newStatus] || newStatus;
      const result = await api.reportCourt({
        courtId: court.id,
        status: backendStatus,
      });
      console.log('Report result:', result);
      
      // Reload court from backend to get fresh data
      const freshData = await api.getCourt(court.id);
      setCourt(freshData.court);
      
      Alert.alert(
        'Thank You!',
        'Status reported. Thanks for your contribution.',
        [{ text: 'OK' }]
      );
    } catch (err) {
      console.error('Failed to report:', err);
    } finally {
      setReporting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !court) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={themeStyles.errorText}>{error || 'Court not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[theme.colors.primary]}
          tintColor={theme.colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{court.name}</Text>
          {court.hasLights && (
            <Ionicons name="flashlight" size={18} color="#FFC107" style={styles.lightIcon} />
          )}
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(court.status) }]} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Address</Text>
        <View style={styles.addressRow}>
          <TouchableOpacity style={styles.addressTextContainer} onPress={() => {
            const url = Platform.OS === 'ios' 
              ? `http://maps.apple.com/?ll=${court.latitude},${court.longitude}&q=${encodeURIComponent(court.address)}`
              : `https://www.google.com/maps/search/?api=1&query=${court.latitude},${court.longitude}`;
            Linking.openURL(url);
          }}>
            <Text style={styles.value}>{court.address}{court.city ? `, ${court.city}` : ''}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapButton} onPress={() => {
            const url = Platform.OS === 'ios' 
              ? `http://maps.apple.com/?ll=${court.latitude},${court.longitude}&q=${encodeURIComponent(court.address)}`
              : `https://www.google.com/maps/search/?api=1&query=${court.latitude},${court.longitude}`;
            Linking.openURL(url);
          }}>
            <Ionicons name="navigate" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: court.latitude,
            longitude: court.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
        >
          <Marker
            coordinate={{ latitude: court.latitude, longitude: court.longitude }}
            title={court.name}
          />
        </MapView>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Last Status Reported</Text>
        <Text style={[styles.lastReportedValue, { color: court.lastReported ? getStatusColor(court.status) : '#000' }]}>
          {court.lastReported 
            ? new Date(court.lastReported).toLocaleString() 
            : 'N/A'}
        </Text>
      </View>

      <View style={styles.row}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Total Courts</Text>
          <Text style={styles.infoValue}>{court.totalCourts}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Type</Text>
          <Text style={styles.infoValue}>{court.courtType}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Surface</Text>
          <Text style={styles.infoValue}>{court.surface}</Text>
        </View>
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Lights</Text>
          <Text style={styles.infoValue}>{court.hasLights ? 'Yes' : 'No'}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[themeStyles.button, styles.reportButton]}
        onPress={handleReportStatus}
        disabled={reporting}
      >
        <Ionicons 
          name="flag" 
          size={20} 
          color="#fff" 
          style={styles.heartIcon}
        />
        <Text style={themeStyles.buttonText}>
          {reporting ? 'Reporting...' : 'Report Current Status'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[themeStyles.button, isFavorite && styles.removeFavoriteButton]}
        onPress={handleAddFavorite}
        disabled={addingFavorite}
      >
        <Ionicons 
          name={isFavorite ? "heart" : "heart-outline"} 
          size={20} 
          color={isFavorite ? "#fff" : "#fff"} 
          style={styles.heartIcon}
        />
        <Text style={themeStyles.buttonText}>
          {addingFavorite ? 'Processing...' : isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
        </Text>
      </TouchableOpacity>

      {court.status && court.status !== 'green' && (
        <TouchableOpacity
          style={[themeStyles.button, styles.notifyButton, notificationEnabled && styles.notifyButtonActive]}
          onPress={handleNotifyToggle}
        >
          <Ionicons 
            name={notificationEnabled ? "notifications" : "notifications-outline"} 
            size={20} 
            color="#fff" 
            style={styles.heartIcon}
          />
          <Text style={themeStyles.buttonText}>
            {notificationEnabled ? 'Notifications On' : 'Notify Me'}
          </Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={showStatusModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowStatusModal(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Report Court Status</Text>
            <TouchableOpacity style={[styles.statusOption, { backgroundColor: '#4CAF50' }]} onPress={() => handleStatusSelect('green')}>
              <Text style={styles.statusOptionText}>Available</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.statusOption, { backgroundColor: '#FF9800' }]} onPress={() => handleStatusSelect('amber')}>
              <Text style={styles.statusOptionText}>Not Available (No Queue)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.statusOption, { backgroundColor: '#F44336' }]} onPress={() => handleStatusSelect('red')}>
              <Text style={styles.statusOptionText}>Busy (In Queue)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowStatusModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  lightIcon: {
    marginLeft: 8,
  },
  cityText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  map: {
    flex: 1,
  },
  favoriteButtonDisabled: {
    backgroundColor: '#9E9E9E',
  },
  favoriteTextDisabled: {
    color: '#E0E0E0',
  },
  removeFavoriteButton: {
    backgroundColor: theme.colors.error,
  },
  heartIcon: {
    marginRight: 8,
  },
  notifyButton: {
    marginTop: 12,
    backgroundColor: '#FF9800',
  },
  notifyButtonActive: {
    backgroundColor: '#4CAF50',
  },
  reportButton: {
    marginTop: 12,
    backgroundColor: '#3B82F6',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 16,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  statusOption: {
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  statusOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancel: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCancelText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  section: {
    marginBottom: 4,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addressTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  mapButton: {
    padding: 6,
  },
  label: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 1,
  },
  value: {
    fontSize: 16,
    color: theme.colors.text,
  },
  lastReportedValue: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  content: {
    padding: 16,
    paddingBottom: 60,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});