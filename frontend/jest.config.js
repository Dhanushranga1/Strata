module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.jest.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/ui/(.*)$': '<rootDir>/src/ui/$1',
    '^@/app/(.*)$': '<rootDir>/src/app/$1',
  },
  collectCoverageFrom: [
    'src/lib/**/*.{ts,tsx}',
    'src/contexts/**/*.{ts,tsx}',
    'src/hooks/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    // Next.js server/edge SDK wrappers — not meaningfully unit-testable in
    // jsdom (need next/headers, next/server, real cookies) and carry no
    // branching logic of our own.
    '!src/lib/supabase/server.ts',
    '!src/lib/supabase/middleware.ts',
    '!src/lib/supabase/client.ts',
    // Pure design-token constants, no logic to cover.
    '!src/lib/chartTheme.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 55,
      functions: 65,
      lines: 70,
      statements: 70,
    },
  },
};
