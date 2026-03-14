import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';

type MainStackParamList = {
  ItemDetail: { itemId: string };
};

export default function ItemDetailScreen() {
  const route = useRoute<RouteProp<MainStackParamList, 'ItemDetail'>>();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Item Detail: {route.params?.itemId}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});