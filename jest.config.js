import dotenv from 'dotenv'

dotenv.config({
	path: '.env.test'
})

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
    scriptPath: "dist/index.js",
    modules: true
  },
  transformIgnorePatterns: ["node_modules/(?!(@planetscale/database|@planetscale/database|@planetscale|planetscale|kysely-planetscale))"],
  moduleFileExtensions: ["ts", "js", "mjs", "cjs", "jsx", "tsx", "json", "node"]
}
