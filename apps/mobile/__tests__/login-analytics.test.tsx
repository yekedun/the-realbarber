import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
}));

const mockSignIn = jest.fn();
jest.mock('../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: (...a: any[]) => mockSignIn(...a) } },
  determineUserRole: jest.fn().mockResolvedValue('owner'),
}));

const mockTrackEvent = jest.fn();
jest.mock('../lib/analytics', () => ({
  trackEvent: (...a: any[]) => mockTrackEvent(...a),
}));

jest.mock('../lib/notifications', () => ({
  registerForPushNotifications: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../lib/google-auth', () => ({
  configureGoogleSignIn: jest.fn(),
  signInWithGoogle: jest.fn().mockResolvedValue({ error: null }),
}));

jest.mock('../lib/router-guard', () => ({
  routeForRole: jest.fn().mockReturnValue('/(owner)'),
}));

// Render ds components as pass-throughs so native modules don't leak into tests
jest.mock('../components/ds/Button', () => {
  const { TouchableOpacity, Text } = require('react-native');
  return {
    Button: ({ children, onPress, disabled }: any) => (
      <TouchableOpacity onPress={disabled ? undefined : onPress} accessibilityRole="button">
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('../components/ds/TextField', () => {
  const { TextInput } = require('react-native');
  return {
    TextField: ({ value, onChangeText, label, ...rest }: any) => (
      <TextInput
        testID={`field-${label}`}
        value={value}
        onChangeText={onChangeText}
        {...rest}
      />
    ),
  };
});

import LoginScreen from '../app/(auth)/login';

describe('LoginScreen analytics', () => {
  beforeEach(() => {
    mockTrackEvent.mockClear();
    mockSignIn.mockClear();
  });

  it('tracks login_fail when email credentials are wrong', async () => {
    mockSignIn.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials', status: 400 },
    });

    const { getByTestId, getAllByRole } = render(<LoginScreen />);

    fireEvent.changeText(getByTestId('field-E-posta'), 'test@example.com');
    fireEvent.changeText(getByTestId('field-Şifre'), 'wrongpass');
    // getAllByRole('button')[0] = email login button (second is Google)
    fireEvent.press(getAllByRole('button')[0]);

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('login_fail', {
        method: 'email',
        code: 400,
      });
    });
  });

  it('tracks login_success when email credentials are correct', async () => {
    mockSignIn.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const { getByTestId, getAllByRole } = render(<LoginScreen />);

    fireEvent.changeText(getByTestId('field-E-posta'), 'owner@dukkan.com');
    fireEvent.changeText(getByTestId('field-Şifre'), 'correctpass');
    // getAllByRole('button')[0] = email login button (second is Google)
    fireEvent.press(getAllByRole('button')[0]);

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith('login_success', {
        method: 'email',
      });
    });
  });
});
