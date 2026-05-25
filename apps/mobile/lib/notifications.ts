import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export function buildExpoPushToken(token: string): string | null {
  if (!token || !token.startsWith('ExponentPushToken[')) return null;
  return token;
}

export async function registerForPushNotifications(): Promise<void> {
  if (!Device.isDevice) return;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Randevu Bildirimleri',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1E3A8A',
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'd1da3258-795a-4a62-b8ad-96c48e79a635',
  });

  const token = buildExpoPushToken(tokenData.data);
  if (!token) {
    console.error('[notifications] Invalid Expo push token format:', tokenData.data);
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error: updateError } = await supabase
    .from('staff')
    .update({ push_token: token })
    .eq('user_id', user.id);
  if (updateError) {
    console.error('[notifications] Failed to save push token:', updateError);
  }
}
