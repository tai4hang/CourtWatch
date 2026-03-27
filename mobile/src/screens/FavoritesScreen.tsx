import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { theme } from '../theme';

interface FavoriteCourt {
  id: string;
  court: {
    id: string;
    name: string;
    address: string;
    city?: string;
    totalCourts: number;
    courtType: string;
    surface: string;
    hasLights: boolean;
    isFree: boolean;
    status?: 'green' | 'amber' | 'red';
  };
  addedAt: string;
}

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

export default function FavoritesScreen() {
  const navigation = useNavigation<any>();
  const [favorites, setFavorites] = useState<FavoriteCourt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [])
  );

  const loadFavorites = async () => {
    try {
      const data = await api.getFavorites();
      setFavorites(data.favorites || []);
    } catch (error) {
      console.error('Failed to load favorites:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFavorites();
  }, []);

  const handleRemoveFavorite = async (courtId: string) => {
    try {
      await api.removeFavorite(courtId);
      setFavorites(prev => prev.filter(f => f.court.id !== courtId));
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  };

  const renderFavorite = ({ item }: { item: FavoriteCourt }) => (
    <TouchableOpacity
      style={styles.courtCard}
      onPress={() => navigation.navigate('CourtDetail', { courtId: item.court.id })}
    >
      <View style={styles.courtHeader}>
        <View style={styles.nameRow}>
          <Text style={styles.courtName}>{item.court.name}</Text>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.court.status) }]} />
        </View>
        <TouchableOpacity onPress={() => handleRemoveFavorite(item.court.id)}>
          <Ionicons name="heart" size={24} color="#EF4444" />
        </TouchableOpacity>
      </View>
      <Text style={styles.courtAddress}>{item.court.city ? `${item.court.city}, ${item.court.address}` : item.court.address}</Text>
      <View style={styles.courtInfo}>
        <Text style={styles.courtInfoText}>{item.court.totalCourts} courts</Text>
        <Text style={styles.courtInfoText}>•</Text>
        <Text style={styles.courtInfoText}>{item.court.surface}</Text>
        <Text style={styles.courtInfoText}>•</Text>
        <Text style={styles.courtInfoText}>{item.court.courtType}</Text>
        {item.court.hasLights && (
          <>
            <Text style={styles.courtInfoText}>•</Text>
            <Text style={styles.courtInfoText}>Lights</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (favorites.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="heart-outline" size={64} color={theme.colors.textSecondary} />
        <Text style={styles.emptyText}>No favorites yet</Text>
        <Text style={styles.emptySubtext}>Tap the heart on a court to add it to your favorites</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={favorites}
        renderItem={renderFavorite}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  list: {
    padding: 16,
    paddingBottom: 400,
  },
  courtCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  courtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  courtName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  statusDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: 12,
  },
  courtAddress: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 4,
  },
  courtInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  courtInfoText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});