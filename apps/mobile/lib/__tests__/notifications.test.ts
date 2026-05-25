jest.mock('../supabase', () => ({ supabase: {} }));
jest.mock('expo-device', () => ({ isDevice: false }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { MAX: 5 },
}));

import { buildExpoPushToken } from '../notifications';

test('buildExpoPushToken geçerli token formatını tanır', () => {
  expect(buildExpoPushToken('ExponentPushToken[abc123]')).toBe('ExponentPushToken[abc123]');
});

test('buildExpoPushToken geçersiz token için null döner', () => {
  expect(buildExpoPushToken('')).toBeNull();
  expect(buildExpoPushToken('invalid')).toBeNull();
  expect(buildExpoPushToken(null as any)).toBeNull();
});
