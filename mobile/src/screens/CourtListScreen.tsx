import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../services/api';

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

export default function CourtListScreen() {
  const navigation = useNavigation<any>();
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadCourts();
  }, []);

  const loadCourts = async () => {
    try {
      const data = await api.getCourts();
      setCourts(data.courts || []);
    } catch (error) {
      console.error('Failed to load courts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCourts = courts.filter(court =>
    court.name.toLowerCase().includes(search.toLowerCase()) ||
    court.address.toLowerCase().includes(search.toLowerCase())
  );

  const renderCourt = ({ item }: { item: Court }) => (
    <TouchableOpacity
      style={styles.courtCard}
      onPress={() => navigation.navigate('CourtDetail', { courtId: item.id })}
    >
      <View style={styles.courtHeader}>
        <Text style={styles.courtName}>{item.name}</Text>
        <View style={[styles.badge, item.isFree ? styles.freeBadge : styles.paidBadge]}>
          <Text style={styles.badgeText}>{item.isFree ? 'Free' : 'Paid'}</Text>
        </View>
      </View>
      <Text style={styles.courtAddress}>{item.address}</Text>
      <View style={styles.courtInfo}>
        <Text style={styles.courtInfoText}>{item.totalCourts} courts</Text>
        <Text style={styles.courtInfoText}>•</Text>
        <Text style={styles.courtInfoText}>{item.surface}</Text>
        <Text style={styles.courtInfoText}>•</Text>
        <Text style={styles.courtInfoText}>{item.courtType}</Text>
        {item.hasLights && (
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
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search courts..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <FlatList
        data={filteredCourts}
        renderItem={renderCourt}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  searchInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  list: {
    padding: 16,
  },
  courtCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    marginBottom: 8,
  },
  courtName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  freeBadge: {
    backgroundColor: '#D1FAE5',
  },
  paidBadge: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  courtAddress: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  courtInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  courtInfoText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});