import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { theme, styles as themeStyles } from '../theme';

export default function NotificationsScreen() {
  return (
    <ScreenContainer>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardText}>No notifications yet</Text>
        </View>
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
    alignItems: 'center',
  },
  cardText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
});