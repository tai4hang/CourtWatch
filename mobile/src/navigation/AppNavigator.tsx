import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { theme } from '../theme';

// Screens
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import CourtListScreen from '../screens/CourtListScreen';
import CourtDetailScreen from '../screens/CourtDetailScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import ItemDetailScreen from '../screens/ItemDetailScreen';
import CreateItemScreen from '../screens/CreateItemScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';

// Types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};

export type MainTabParamList = {
  CourtList: undefined;
  Favorites: undefined;
  Notifications: undefined;
  Settings: undefined;
};

export type MainStackParamList = {
  Tab: undefined;
  ItemDetail: { itemId: string };
  CreateItem: undefined;
  Subscription: undefined;
  CourtDetail: { courtId: string };
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

function MainTabNavigator() {
  const CustomHeader = ({ title }: { title: string }) => (
    <View style={headerStyles.container}>
      <Image source={require('../../assets/app-small-icon.png')} style={headerStyles.logo} />
      <Text style={headerStyles.title}>{title}</Text>
    </View>
  );

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.text,
      }}
    >
      <Tab.Screen 
        name="CourtList" 
        component={CourtListScreen}
        options={{ 
          headerTitle: () => <CustomHeader title="Courts" />,
          tabBarLabel: 'Courts',
          tabBarIcon: ({ color, size }) => <TabIcon name="tennis" color={color} size={size} />,
        }}
      />
      <Tab.Screen 
        name="Favorites" 
        component={FavoritesScreen}
        options={{ 
          headerTitle: () => <CustomHeader title="Favorites" />,
          tabBarLabel: 'Favorites',
          tabBarIcon: ({ color, size }) => <TabIcon name="heart" color={color} size={size} />,
        }}
      />
      <Tab.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{ 
          headerTitle: () => <CustomHeader title="Notifications" />,
          tabBarLabel: 'Notifications',
          tabBarIcon: ({ color, size }) => <TabIcon name="bell" color={color} size={size} />,
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ 
          headerTitle: () => <CustomHeader title="Settings" />,
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => <TabIcon name="settings" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator>
      <MainStack.Screen 
        name="Tab" 
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <MainStack.Screen name="ItemDetail" component={ItemDetailScreen} />
      <MainStack.Screen name="CreateItem" component={CreateItemScreen} options={{ title: 'New Item' }} />
      <MainStack.Screen name="Subscription" component={SubscriptionScreen} options={{ title: 'Subscription' }} />
      <MainStack.Screen name="CourtDetail" component={CourtDetailScreen} options={{ title: 'Court Details' }} />
    </MainStack.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return null; // Or a splash screen
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <RootStack.Screen name="Main" component={MainNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

function TabIcon({ name, color, size }: { name: string; color: string; size: number }) {
  const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
    home: 'home',
    tennis: 'tennisball',
    heart: 'heart',
    bell: 'notifications',
    settings: 'settings',
  };
  return <Ionicons name={iconMap[name] || 'circle'} size={size} color={color} />;
}

const headerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 32,
    height: 32,
    marginRight: 8,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
});
