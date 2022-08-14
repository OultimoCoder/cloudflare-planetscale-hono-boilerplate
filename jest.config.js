import dotenv from 'dotenv'

dotenv.config({
	path: '.env.test'
})

export default {
  testEnvironment: 'miniflare',
  moduleFileExtensions: ['js', 'jsx', 'mjs'],
  coverageReporters: ['json-summary', 'html'],
  testTimeout: 5000,
  testRegex: '(\/tests\/.*|(.|\/))test.(mjs?|jsx?|js?|tsx?|ts?)$'
}
