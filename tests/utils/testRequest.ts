import app from '../../src'
import '../../src/routes'

const devUrl = 'http://localhost'
const env = getMiniflareBindings()

const request = async(path: string, options: RequestInit) => {
  const formattedUrl = new URL(path, devUrl).href
  const request = new Request(formattedUrl, options)
  return app.fetch(request, env)
}

export {
  request
}
