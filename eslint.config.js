import eslint from '@eslint/js'
import importx from 'eslint-plugin-import-x'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import vitest from 'eslint-plugin-vitest'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const defaultFiles = [
  'src/**',
  'tests/**',
  'bindings.d.ts',
  'scripts/**',
  'migrations/**'
]

const config = {
  languageOptions: {
    sourceType: 'module',
    ecmaVersion: 2021,
    globals: {
      ...globals.node,
      ...globals.browser,
      ...globals.serviceworker,
      fetch: 'readonly',
      Response: 'readonly',
      Request: 'readonly',
      addEventListener: 'readonly',
      ENV: 'readonly'
    },
  },
  plugins: { 'import-x': importx },
  rules: {
    quotes: ['error', 'single'],
    'no-console': 'error',
    'sort-imports': 'off',
    'import-x/order': [
      'error',
      {
        alphabetize: { order: 'asc' },
      }
    ],
    'node/no-missing-import': 'off',
    'node/no-missing-require': 'off',
    'node/no-deprecated-api': 'off',
    'node/no-unpublished-import': 'off',
    'node/no-unpublished-require': 'off',
    'node/no-unsupported-features/es-syntax': 'off',
    semi: ['error', 'never'],
    'no-debugger': ['error'],
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-process-exit': 'off',
    'no-useless-escape': 'off',
    'max-len': ['error', { code: 100 }],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
  },
  files: defaultFiles
}

export const testConfig = {
  ...vitest.configs.recommended,
  plugins: { vitest: vitest },
  files: ['tests/**']
}

export default tseslint.config(
  {
    ignores: ['dist/', 'coverage/', 'node_modules/'],
  },
  {
    files: defaultFiles,
    ...eslint.configs.recommended
  },
  ...tseslint.configs.recommended,
  config,
  testConfig,
  {
    files: defaultFiles,
    ...eslintPluginPrettierRecommended
  }
)

