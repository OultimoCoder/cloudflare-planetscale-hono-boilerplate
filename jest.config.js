export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  clearMocks: true,
  globals: {
    'ts-jest': {
      tsconfig: 'tests/tsconfig.json',
      useESM: true,
      isolatedModules: true,
    },
  },
  testEnvironment: 'miniflare',
  testEnvironmentOptions: {
    scriptPath: 'dist/index.mjs',
    modules: true
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@planetscale|kysely-planetscale|@aws-sdk|worker-auth-providers|uuid))'
  ],
  moduleNameMapper: {'^uuid$': 'uuid'},
  collectCoverageFrom: ['src/**/*.{ts,js}'],
  coveragePathIgnorePatterns: [
    'src/durable-objects'  // Jest doesn't accurately report coverage for Durable Objects
  ],
  testTimeout: 20000
}
