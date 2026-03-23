import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { api } from '../services/api';
import { theme, styles as themeStyles } from '../theme';

type MainStackParamList = {
  CourtDetail: { courtId: string };
};

interface Court {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  totalCourts: number;
  courtType: string;
  surface: string;
  hasLights: boolean;
  isFree: boolean;
}

export default function CourtDetailScreen() {
  const route = useRoute<RouteProp<MainStackParamList, 'CourtDetail'>>();
  const navigation = useNavigation();
  const [court, setCourt] = useState<Court | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCourt();
  }, [route.params.courtId]);

  const loadCourt = async () => {
    try {
      const data = await api.getCourt(route.params.courtId);
      setCourt(data.court);
    } catch (err) {
      console.error('Failed to load court:', err);
      setError('Failed to load court details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[themeStyles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !court) {
    return (
      <View style={[themeStyles.container, styles.centered]}>
        <Text style={themeStyles.errorText}>{error || 'Court not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={themeStyles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{court.name}</Text>
        <View style={[styles.badge, court.isFree ? styles.freeBadge : styles.paidBadge]}>
          <Text style={styles.badgeText}>{court.isFree ? 'Free' : 'Paid'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Address</Text>
        <Text style={styles.value}>{court.address}</Text>
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

      <TouchableOpacity style={themeStyles.button} onPress={() => api.addFavorite(court.id)}>
        <Text style={themeStyles.buttonText}>Add to Favorites</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  freeBadge: {
    backgroundColor: '#4CAF50',
  },
  paidBadge: {
    backgroundColor: '#FF9800',
  },
  badgeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  section: {
    marginBottom: 16,
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
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: 16,
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});