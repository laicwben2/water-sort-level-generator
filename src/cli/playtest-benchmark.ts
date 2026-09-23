import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const htmlPath = resolve(root, 'tools/benchmark-playtest/index.html')
const benchmarkPath = resolve(root, 'data/benchmarks/difficulty-v2-benchmark-v1-blind.json')
const port = Number(process.env.PORT ?? 4174)

if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error('PORT must be an integer from 1 to 65535')
}

const server = createServer(async (request, response) => {
  try {
    const path = request.url?.split('?')[0] ?? '/'

    if (path === '/' || path === '/index.html') {
      const html = await readFile(htmlPath)
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      response.end(html)
      return
    }

    if (path === '/benchmark.json') {
      const benchmark = await readFile(benchmarkPath)
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      response.end(benchmark)
      return
    }

    if (path === '/health') {
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('ok')
      return
    }

    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  } catch (error) {
    console.error(error)
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Internal server error')
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Difficulty v2 benchmark playtest: http://127.0.0.1:${port}`)
})
