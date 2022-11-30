
import { MockAgent } from 'undici'

declare global {
  function getMiniflareBindings(): Bindings
  function getMiniflareFetchMock(): MockAgent
  function getMiniflareDurableObjectStorage(id: DurableObjectId): Promise<DurableObjectStorage>
  function flushMiniflareDurableObjectAlarms(ids?: DurableObjectId[] ): Promise<void>
}

export {}
