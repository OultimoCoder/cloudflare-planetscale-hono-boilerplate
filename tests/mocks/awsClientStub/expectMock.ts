import { AwsStub } from "./awsClientStub";

// eslint-disable-next-line
export function toHaveReceivedCommandTimes(mock: AwsStub<any, any, any>, command: unknown, times: number) {
	const calls = mock.send.mock.calls
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

declare module "vitest" {
	interface Assertion<T = any> extends CustomMatchers<T> {}
	interface AsymmetricMatchersContaining extends CustomMatchers {}
}