jest.mock('../supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    }),
  },
}));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test123]' }),
  AndroidImportance: { MAX: 5 },
}));

import { buildExpoPushToken, registerForPushNotifications } from '../notifications';

test('buildExpoPushToken geçerli token formatını tanır', () => {
  expect(buildExpoPushToken('ExponentPushToken[abc123]')).toBe('ExponentPushToken[abc123]');
});

test('buildExpoPushToken geçersiz token için null döner', () => {
  expect(buildExpoPushToken('')).toBeNull();
  expect(buildExpoPushToken('invalid')).toBeNull();
  expect(buildExpoPushToken(null as any)).toBeNull();
});

test('registerForPushNotifications saves valid token to staff table', async () => {
  const { supabase } = require('../supabase');
  await registerForPushNotifications();
  expect(supabase.from).toHaveBeenCalledWith('staff');
});

test('registerForPushNotifications skips on non-device', async () => {
  jest.resetModules();
  jest.mock('expo-device', () => ({ isDevice: false }));
  const { registerForPushNotifications: reg } = require('../notifications');
  const { supabase } = require('../supabase');
  supabase.from.mockClear();
  await reg();
  expect(supabase.from).not.toHaveBeenCalled();
});
