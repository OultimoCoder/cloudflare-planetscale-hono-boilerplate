import { Client, Command, MetadataBearer } from '@smithy/types'
import { MockInstance, vi, Mock } from 'vitest'
import { mockClient } from './mock-client'

export type AwsClientBehavior<TClient> =
  TClient extends Client<infer TInput, infer TOutput, infer TConfiguration>
    ? Behavior<TInput, TOutput, TOutput, TConfiguration>
    : never

export interface Behavior<
  TInput extends object,
  TOutput extends MetadataBearer,
  TCommandOutput extends TOutput,
  TConfiguration
> {
  on<TCmdInput extends TInput, TCmdOutput extends TOutput>(
    command: new (input: TCmdInput) => AwsCommand<TCmdInput, TCmdOutput, TInput, TOutput>,
    input?: Partial<TCmdInput>,
    strict?: boolean
  ): Behavior<TInput, TOutput, TCmdOutput, TConfiguration>

  resolves(response: CommandResponse<TCommandOutput>): AwsStub<TInput, TOutput, TConfiguration>

  rejects(error?: string | Error | AwsError): AwsStub<TInput, TOutput, TConfiguration>
}

/**
 * Type for {@link AwsStub} class,
 * but with the AWS Client class type as an only generic parameter.
 *
 * @example
 * ```ts
 * let snsMock: AwsClientStub<SNSClient>;
 * snsMock = mockClient(SNSClient);
 * ```
 */
export type AwsClientStub<TClient> =
  TClient extends Client<infer TInput, infer TOutput, infer TConfiguration>
    ? AwsStub<TInput, TOutput, TConfiguration>
    : never

type MockCall<In extends unknown[], Out> = {
  args: In
  result: MockResult<Out>
}

type MockResult<T> =
  | {
      type: 'return'
      value: T
    }
  | {
      type: 'throw'
      value: unknown
    }

type Inputs<TInput extends object, TOutput extends MetadataBearer, TConfiguration> = Parameters<
  Client<TInput, TOutput, TConfiguration>['send']
>
type Output<TInput extends object, TOutput extends MetadataBearer, TConfiguration> = ReturnType<
  Client<TInput, TOutput, TConfiguration>['send']
>

/**
 * Wrapper on the mocked `Client#send()` method,
 * allowing to configure its behavior.
 *
 * Without any configuration, `Client#send()` invocation returns `undefined`.
 *
 * To define resulting variable type easily, use {@link AwsClientStub}.
 */
export class AwsStub<TInput extends object, TOutput extends MetadataBearer, TConfiguration> {
  /**
   * Underlying `Client#send()` method Sinon stub.
   *
   * Install `@types/sinon` for TypeScript typings.
   */
  public send: MockInstance<
    Inputs<TInput, TOutput, TConfiguration>,
    Output<TInput, TOutput, TConfiguration>
  >

  constructor(
    private client: Client<TInput, TOutput, TConfiguration>,
    send: MockInstance<
      Inputs<TInput, TOutput, TConfiguration>,
      Output<TInput, TOutput, TConfiguration>
    >
  ) {
    this.send = send
  }

  /** Returns the class name of the underlying mocked client class */
  clientName(): string {
    return this.client.constructor.name
  }

  /**
   * Resets stub. It will replace the stub with a new one, with clean history and behavior.
   */
  reset(): AwsStub<TInput, TOutput, TConfiguration> {
    /* sinon.stub.reset() does not remove the fakes which in some conditions can break subsequent stubs,
     * so instead of calling send.reset(), we recreate the stub.
     * See: https://github.com/sinonjs/sinon/issues/1572
     * We are only affected by the broken reset() behavior of this bug, since we always use matchers.
     */
    const newStub = mockClient(this.client)
    this.send = newStub.send
    return this
  }

  /** Replaces stub with original `Client#send()` method. */
  restore(): void {
    this.send.mockRestore()
  }

  /**
   * Returns recorded calls to the stub.
   */
  calls(): MockCall<
    Inputs<TInput, TOutput, TConfiguration>,
    Output<TInput, TOutput, TConfiguration>
  >[] {
    return this.send.mock.calls.map(
      (call, i) =>
        ({
          args: call,
          result: this.send.mock.results[i]
        }) as MockCall<
          Inputs<TInput, TOutput, TConfiguration>,
          Output<TInput, TOutput, TConfiguration>
        >
    )
  }

  /**
   * Returns n-th recorded call to the stub.
   */
  call(
    n: number
  ): MockCall<Inputs<TInput, TOutput, TConfiguration>, Output<TInput, TOutput, TConfiguration>> {
    return this.calls()[n]
  }

  /**
   * Allows specifying the behavior for a given Command type and its input (parameters).
   *
   * If the input is not specified, it will match any Command of that type.
   *
   * @example
   * ```js
   * snsMock
   *   .on(PublishCommand, {Message: 'My message'})
   *   .resolves({MessageId: '111'});
   * ```
   *
   * @param command Command type to match
   * @param input Command payload to match
   * @param strict Should the payload match strictly (default false, will match if all defined payload properties match)
   */
  on<TCmdInput extends TInput, TCmdOutput extends TOutput>(
    command: new (input: TCmdInput) => AwsCommand<TCmdInput, TCmdOutput, TInput, TOutput>
  ): CommandBehavior<TInput, TOutput, TCmdOutput, TConfiguration> {
    const cmdStub: Mock<
      Inputs<TInput, TOutput, TConfiguration>,
      Output<TInput, TOutput, TConfiguration>
    > = vi.fn((cmd, opts, cb) => {
      return this.client.send(cmd, opts, cb)
    })
    this.send.mockImplementation((cmd, opts, cb) => {
      if (cmd instanceof command) return cmdStub(cmd, opts, cb)
      return this.client.send(cmd, opts, cb)
    })
    return new CommandBehavior<TInput, TOutput, TCmdOutput, TConfiguration>(this, cmdStub)
  }
}

export class CommandBehavior<
  TInput extends object,
  TOutput extends MetadataBearer,
  TCommandOutput extends TOutput,
  TConfiguration
> {
  constructor(
    private clientStub: AwsStub<TInput, TOutput, TConfiguration>,
    private send: Mock<
      Inputs<TInput, TOutput, TConfiguration>,
      Output<TInput, TOutput, TConfiguration>
    >
  ) {}

  /**
   * Sets a successful response that will be returned from `Client#send()` invocation for the current `Command`.
   *
   * @example
   * ```js
   * snsMock
   *   .on(PublishCommand)
   *   .resolves({MessageId: '111'});
   * ```
   *
   * @param response Content to be returned
   */
  resolves(
    response: Awaited<CommandResponse<TCommandOutput>>
  ): AwsStub<TInput, TOutput, TConfiguration> {
    this.send.mockImplementation(() => Promise.resolve(response) as unknown as Promise<TOutput>)
    return this.clientStub
  }

  /**
   * Sets a failure response that will be returned from `Client#send()` invocation for the current `Command`.
   * The response will always be an `Error` instance.
   *
   * @example
   * ```js
   * snsMock
   *   .on(PublishCommand)
   *   .rejects('mocked rejection');
   *```
   *
   * @example
   * ```js
   * const throttlingError = new Error('mocked rejection');
   * throttlingError.name = 'ThrottlingException';
   * snsMock
   *   .on(PublishCommand)
   *   .rejects(throttlingError);
   * ```
   *
   * @param error Error text, Error instance or Error parameters to be returned
   */
  rejects(error?: string | Error | AwsError): AwsStub<TInput, TOutput, TConfiguration> {
    this.send.mockImplementation(() => Promise.reject(error))
    return this.clientStub
  }
}

export type AwsCommand<
  Input extends ClientInput,
  Output extends ClientOutput,
  ClientInput extends object,
  ClientOutput extends MetadataBearer
> = Command<ClientInput, Input, ClientOutput, Output, unknown>
type CommandResponse<TOutput> = Partial<TOutput> | PromiseLike<Partial<TOutput>>

export interface AwsError extends Partial<Error>, Partial<MetadataBearer> {
  Type?: string
  Code?: string
  $fault?: 'client' | 'server'
  $service?: string
}
