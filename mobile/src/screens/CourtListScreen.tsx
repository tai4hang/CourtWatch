import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { api } from '../services/api';
import { theme } from '../theme';

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
  status?: string;
  lastReported?: string;
  distance_km?: number;
}

type FilterType = 'all' | 'nearby' | 'available';

export default function CourtListScreen() {
  const navigation = useNavigation<any>();
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showCityModal, setShowCityModal] = useState(false);
  const [cities] = useState<string[]>(['Markham', 'Toronto', 'North York', 'Scarborough', 'Etobicoke', 'Richmond Hill', 'Mississauga', 'Brampton']);
  const [selectedCities, setSelectedCities] = useState<string[]>(['Markham', 'Toronto', 'North York', 'Scarborough', 'Etobicoke', 'Richmond Hill', 'Mississauga', 'Brampton']);
  const [location, setLocation] = useState<{latitude: number; longitude: number} | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadCourts();
      requestLocation();
    }, [filter])
  );

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    } catch (error) {
      console.log('Location error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCourts();
    setRefreshing(false);
  };

  const loadCourts = async () => {
    try {
      let data;
      if (filter === 'nearby' && location) {
        data = await api.getNearbyCourts(location.latitude, location.longitude, 10, 500);
      } else {
        const status = filter === 'available' ? 'AVAILABLE' : undefined;
        const city = selectedCities.length > 0 && selectedCities.length < cities.length ? selectedCities.join(',') : undefined;
        data = await api.getCourts(1, 500, search, status, city);
      }
      setCourts(data.courts || []);
    } catch (error) {
      console.error('Failed to load courts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearch(text);
  };

  const onSearchSubmit = () => {
    loadCourts();
  };

  const filteredCourts = courts.filter(court =>
    court.name.toLowerCase().includes(search.toLowerCase()) ||
    court.address.toLowerCase().includes(search.toLowerCase())
  );

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

  const renderCourt = ({ item }: { item: Court }) => (
    <TouchableOpacity
      style={styles.courtCard}
      onPress={() => navigation.navigate('CourtDetail', { courtId: item.id })}
    >
      <View style={styles.courtHeader}>
        <View style={styles.nameRow}>
          <Text style={styles.courtName}>{item.name}</Text>
          {item.hasLights && (
            <Text style={styles.lightIcon}>💡</Text>
          )}
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
        </View>
      </View>
      <Text style={styles.courtAddress}>{item.city ? `${item.city}, ${item.address}` : item.address}</Text>
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
        {item.distance_km !== undefined && (
          <Text style={styles.distanceText}>{item.distance_km.toFixed(1)} km</Text>
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

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search courts..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={handleSearch}
            onSubmitEditing={onSearchSubmit}
            returnKeyType="search"
          />
          <TouchableOpacity 
            style={styles.filterIconButton}
            onPress={() => setShowCityModal(true)}
          >
            <Ionicons name="filter" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.filterContainer}>
          <TouchableOpacity 
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]} 
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, filter === 'nearby' && styles.filterButtonActive]} 
            onPress={() => setFilter('nearby')}
          >
            <Text style={[styles.filterText, filter === 'nearby' && styles.filterTextActive]}>Nearby</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.filterButton, filter === 'available' && styles.filterButtonActive]} 
            onPress={() => setFilter('available')}
          >
            <Text style={[styles.filterText, filter === 'available' && styles.filterTextActive]}>Available</Text>
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={filteredCourts}
        renderItem={renderCourt}
        keyExtractor={(item) => item.id || Math.random().toString()}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      />

      {/* City Filter Modal */}
      <Modal
        visible={showCityModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCityModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter by City</Text>
            <TouchableOpacity 
              style={styles.cityRow}
              onPress={() => {
                if (selectedCities.length === cities.length) {
                  setSelectedCities([]);
                } else {
                  setSelectedCities([...cities]);
                }
              }}
            >
              <View style={[styles.checkbox, selectedCities.length === cities.length && styles.checkboxChecked]}>
                {selectedCities.length === cities.length && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </View>
              <Text style={styles.cityText}>All</Text>
            </TouchableOpacity>
            {cities.map((city) => (
              <TouchableOpacity 
                key={city} 
                style={styles.cityRow}
                onPress={() => {
                  if (selectedCities.includes(city)) {
                    setSelectedCities(selectedCities.filter((c) => c !== city));
                  } else {
                    setSelectedCities([...selectedCities, city]);
                  }
                }}
              >
                <View style={[styles.checkbox, selectedCities.includes(city) && styles.checkboxChecked]}>
                  {selectedCities.includes(city) && (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  )}
                </View>
                <Text style={styles.cityText}>{city}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton]}
                onPress={() => {
                  setSelectedCities([]);
                }}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.textSecondary }]}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => {
                  loadCourts();
                  setShowCityModal(false);
                }}
              >
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
    backgroundColor: theme.colors.surface,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: 12,
    fontSize: 16,
    color: theme.colors.text,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingTop: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  courtCard: {
    backgroundColor: theme.colors.surface,
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
    color: theme.colors.text,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  lightIcon: {
    marginLeft: 6,
    fontSize: 14,
  },
  statusContainer: {
    marginLeft: 8,
  },
  statusDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#fff',
  },
  courtAddress: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  courtInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  courtInfoText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  distanceText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  filterIconButton: {
    padding: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    margin: 20,
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 16,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  cityText: {
    fontSize: 16,
    color: theme.colors.text,
    marginLeft: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});