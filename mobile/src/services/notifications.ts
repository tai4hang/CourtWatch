import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { Notification, NotificationBehavior } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { api } from './api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async (_notification: Notification): Promise<NotificationBehavior> => {
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push notification permissions');
    return null;
  }

  // Get the FCM token (APNs on iOS, FCM on Android)
  const expoPushToken = await Notifications.getExpoPushTokenAsync();
  
  console.log('Expo Push Token:', expoPushToken.data);
  
  // Store locally
  await SecureStore.setItemAsync('pushToken', expoPushToken.data);
  
  // Send to backend
  try {
    await api.registerPushToken(expoPushToken.data);
  } catch (err) {
    console.error('Failed to register push token with backend:', err);
  }

  return expoPushToken.data;
}

export async function subscribeToCourtNotifications(courtId: string): Promise<void> {
  try {
    await api.subscribeToCourt(courtId);
  } catch (err) {
    console.error('Failed to subscribe to court notifications:', err);
    throw err;
  }
}

export async function unsubscribeFromCourtNotifications(courtId: string): Promise<void> {
  try {
    await api.unsubscribeFromCourt(courtId);
  } catch (err) {
    console.error('Failed to unsubscribe from court notifications:', err);
    throw err;
  }
}

export async function getStoredPushToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('pushToken');
  } catch {
    return null;
  }
}

// Set up notification listener for when app is in foreground
export function setupNotificationListeners(
  onNotificationReceived: (notification: Notifications.Notification) => void
) {
  const subscription = Notifications.addNotificationReceivedListener(
    onNotificationReceived
  );

  return () => {
    subscription.remove();
  };
}