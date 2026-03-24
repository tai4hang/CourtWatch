import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { theme, styles as themeStyles } from '../theme';

export default function DashboardScreen() {
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={themeStyles.title}>Dashboard</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome to CourtWatch</Text>
          <Text style={styles.cardText}>Monitor tennis court availability in real-time.</Text>
        </View>
      </ScrollView>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
});