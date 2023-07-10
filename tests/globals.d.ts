
import { MockAgent } from 'undici'
import { Environment } from '../bindings'

declare global {
  function getMiniflareBindings(): Environment['Bindings']
  function getMiniflareFetchMock(): MockAgent
  function getMiniflareDurableObjectStorage(id: DurableObjectId): Promise<DurableObjectStorage>
  function flushMiniflareDurableObjectAlarms(ids?: DurableObjectId[] ): Promise<void>
}

export {}
