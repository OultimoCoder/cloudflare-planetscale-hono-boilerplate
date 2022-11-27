
import { MockAgent } from 'undici'

declare global {
  function getMiniflareBindings(): Bindings
  function getMiniflareFetchMock(): MockAgent
  function getMiniflareDurableObjectStorage(id: DurableObjectId): Promise<DurableObjectStorage>
}

export {}
