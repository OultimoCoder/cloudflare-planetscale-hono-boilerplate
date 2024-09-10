import { AwsStub } from './aws-client-stub'

// eslint-disable-next-line
export function toHaveReceivedCommandTimes(mock: AwsStub<any, any, any>, command: unknown, times: number) {
  const calls = mock.send.mock.calls
    // eslint-disable-next-line
		.filter((call) => call[0] instanceof (command as any))
		.length

  return {
    pass: calls === times,
    message: () => `Function was called ${calls} times with input, expected ${times} calls`
  }
}

export const expectExtension = {
  toHaveReceivedCommandTimes
}

interface CustomMatchers<R = unknown> {
  // eslint-disable-next-line
	toHaveReceivedCommandTimes: (command: unknown, times: number) => R
}

declare module 'vitest' {
  // eslint-disable-next-line
	interface Assertion<T = any> extends CustomMatchers<T> {}
  // eslint-disable-next-line
	interface AsymmetricMatchersContaining extends CustomMatchers {}
}
