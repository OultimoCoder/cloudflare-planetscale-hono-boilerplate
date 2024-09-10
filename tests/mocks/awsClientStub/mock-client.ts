import { Client, MetadataBearer } from '@smithy/types'
import { vi } from 'vitest'
import { AwsClientStub, AwsStub } from './aws-client-stub'

/**
 * Creates and attaches a stub of the `Client#send()` method. Only this single method is mocked.
 * If method is already a stub, it's replaced.
 * @param client `Client` type or instance to replace the method
 * @param sandbox Optional sinon sandbox to use
 * @return Stub allowing to configure Client's behavior
 */
export const mockClient = <TInput extends object, TOutput extends MetadataBearer, TConfiguration>(
  client: InstanceOrClassType<Client<TInput, TOutput, TConfiguration>>
): AwsClientStub<Client<TInput, TOutput, TConfiguration>> => {
  const instance = isClientInstance(client) ? client : client.prototype

  // const send = instance.send;
  // if (vi.isMockFunction(send)) {
  //     send.restore();
  // }

  const sendStub = vi.spyOn(instance, 'send')

  return new AwsStub<TInput, TOutput, TConfiguration>(instance, sendStub)
}

type ClassType<T> = {
  prototype: T
}

type InstanceOrClassType<T> = T | ClassType<T>

/**
 * Type guard to differentiate `Client` instance from a type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isClientInstance = <TClient extends Client<any, any, any>>(
  obj: InstanceOrClassType<TClient>
): obj is TClient => (obj as TClient).send !== undefined
