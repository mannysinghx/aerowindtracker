// When running as a native Capacitor app, relative /api/* calls won't resolve.
// Prefix them with the live backend so the native app hits Vercel functions.
export const API_BASE = (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform())
  ? 'https://www.aerowindy.com'
  : '';
