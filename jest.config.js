export default {
  preset: 'ts-jest/presets/js-with-ts',
  clearMocks: true,
  globals: {
    "ts-jest": {
      tsconfig: "tests/tsconfig.json",
      useESM: true,
      isolatedModules: true,
    },
  },
  testEnvironment: 'miniflare',
  testEnvironmentOptions: {
    scriptPath: "dist/index.mjs",
    modules: true
  },
  transformIgnorePatterns: ["node_modules/(?!(@planetscale|kysely-planetscale))"],
}
