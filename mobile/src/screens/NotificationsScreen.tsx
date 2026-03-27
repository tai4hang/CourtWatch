import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ScreenContainer from '../components/ScreenContainer';
import { theme, styles as themeStyles } from '../theme';
import { api } from '../services/api';

interface CourtSubscription {
  id: string;
  court_id: string;
  court?: {
    id: string;
    name: string;
    address: string;
    city: string | null;
  };
  created_at: string;
}

export default function NotificationsScreen() {
  const [subscriptions, setSubscriptions] = useState<CourtSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const { subscriptions: subs } = await api.getCourtSubscriptions();
      setSubscriptions(subs || []);
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
      setSubscriptions([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSubscriptions();
  }, [loadSubscriptions]);

  useFocusEffect(
    useCallback(() => {
      loadSubscriptions();
    }, [loadSubscriptions])
  );

  const handleRemove = (courtId: string, courtName: string) => {
    Alert.alert(
      'Remove Notification',
      `Stop receiving notifications for ${courtName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.unsubscribeFromCourt(courtId);
              setSubscriptions(prev => prev.filter(s => s.court_id !== courtId));
            } catch (error) {
              console.error('Failed to remove subscription:', error);
              Alert.alert('Error', 'Failed to remove notification');
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: CourtSubscription }) => (
    <View style={styles.card}>
      <View style={styles.cardContent}>
        <Text style={styles.courtName}>{item.court?.name || 'Unknown Court'}</Text>
        <Text style={styles.courtAddress}>{item.court?.address || item.court_id}</Text>
        {item.court?.city && (
          <Text style={styles.courtCity}>{item.court.city}</Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemove(item.court_id, item.court?.name || 'this court')}
      >
        <Text style={styles.removeButtonText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScreenContainer>
      <View style={styles.content}>
        <Text style={styles.title}>Court Notifications</Text>
        <Text style={styles.subtitle}>Manage your court update notifications</Text>
        
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : subscriptions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No court notifications</Text>
            <Text style={styles.emptySubtext}>
              Subscribe to courts from the court list to receive status updates
            </Text>
          </View>
        ) : (
          <FlatList
            data={subscriptions}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.colors.primary]}
                tintColor={theme.colors.primary}
              />
            }
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 400,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardContent: {
    flex: 1,
    marginRight: 12,
  },
  courtName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 2,
  },
  courtAddress: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  courtCity: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  removeButton: {
    backgroundColor: theme.colors.error || '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});