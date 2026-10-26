module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.ts'],
  // The first screen test in a file also pays for loading and transforming React Native
  // modules; on a cold cache that alone can pass Jest's 5s default.
  testTimeout: 20000,
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@react-navigation/.*|@supabase/.*|i18next|react-i18next))',
  ],
};
