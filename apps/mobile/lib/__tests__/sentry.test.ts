jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setUser: jest.fn(),
  captureException: jest.fn(),
  ErrorBoundary: jest.fn(({ children }: { children: React.ReactNode }) => children),
}));

const mockSentry = require('@sentry/react-native');
const { initSentry, setSentryUserFromSession, captureSentryVerificationError, __resetSentryForTest } = require('../sentry');

describe('sentry utility', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockSentry.init.mockClear();
    mockSentry.setUser.mockClear();
    mockSentry.captureException.mockClear();
    __resetSentryForTest();
  });

  it('does not initialize Sentry when DSN is missing', () => {
    initSentry();
    initSentry();

    expect(mockSentry.init).not.toHaveBeenCalled();
  });

  it('initializes Sentry once when DSN is configured', () => {
    initSentry('https://public@example.ingest.sentry.io/123');
    initSentry('https://public@example.ingest.sentry.io/123');

    expect(mockSentry.init).toHaveBeenCalledTimes(1);
    expect(mockSentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://public@example.ingest.sentry.io/123',
        enabled: true,
        enableAutoSessionTracking: true,
      }),
    );
  });

  it('sets a minimal Sentry user from a Supabase session', () => {
    setSentryUserFromSession({
      user: {
        id: 'user-123',
        email: 'owner@example.com',
      },
    } as any);

    expect(mockSentry.setUser).toHaveBeenCalledWith({
      id: 'user-123',
      email: 'owner@example.com',
    });
  });

  it('clears the Sentry user when session is null', () => {
    setSentryUserFromSession(null);

    expect(mockSentry.setUser).toHaveBeenCalledWith(null);
  });

  it('captures manual verification errors', () => {
    captureSentryVerificationError();

    expect(mockSentry.captureException).toHaveBeenCalledWith(expect.any(Error));
    expect(mockSentry.captureException.mock.calls[0][0].message).toBe(
      'Sentry mobile verification error',
    );
  });
});