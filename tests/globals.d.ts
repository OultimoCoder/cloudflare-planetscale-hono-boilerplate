
import { MockAgent } from 'undici'

declare global {
  function getMiniflareBindings(): Bindings
  function getMiniflareFetchMock(): MockAgent
}

export {}
