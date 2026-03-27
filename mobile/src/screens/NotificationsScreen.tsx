import React, { useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import ScreenContainer from '../components/ScreenContainer';
import { useNotificationStore, CourtNotification } from '../store/notificationStore';
import { theme, styles as themeStyles } from '../theme';

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const { notifications, loadNotifications, removeNotification, isLoading } = useNotificationStore();

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleRemove = (courtId: string, courtName: string) => {
    Alert.alert(
      'Remove Notification',
      `Stop receiving notifications for ${courtName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: () => removeNotification(courtId)
        },
      ]
    );
  };

  const handleCourtPress = (courtId: string) => {
    navigation.navigate('CourtDetail', { courtId });
  };

  const renderNotification = ({ item }: { item: CourtNotification }) => (
    <View style={styles.card}>
      <TouchableOpacity 
        style={styles.cardContent}
        onPress={() => handleCourtPress(item.courtId)}
      >
        <View style={styles.courtInfo}>
          <Text style={styles.courtName}>{item.courtName}</Text>
          <Text style={styles.enabledText}>
            Enabled {new Date(item.enabledAt).toLocaleDateString()}
          </Text>
        </View>
        <TouchableOpacity 
          style={styles.removeButton}
          onPress={() => handleRemove(item.courtId, item.courtName)}
        >
          <Ionicons name="close-circle" size={28} color={theme.colors.error} />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.content}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.content}>
        {notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="notifications-outline" size={48} color={theme.colors.textSecondary} />
            <Text style={styles.emptyText}>No notifications yet</Text>
            <Text style={styles.emptySubtext}>
              Tap "Notify Me" on a court detail page to get notified when its status changes
            </Text>
          </View>
        ) : (
          <FlatList
            data={notifications}
            renderItem={renderNotification}
            keyExtractor={(item) => item.courtId}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  courtInfo: {
    flex: 1,
  },
  courtName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  enabledText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  removeButton: {
    padding: 4,
  },
  emptyCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
});