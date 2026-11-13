import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve, sep } from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import { RecipeWriteError, isSafeRecipeId, prepareRecipeWrite } from '../src/lib/recipeWrite.ts'
import { categoriesFileSchema, tagsFileSchema } from '../src/lib/schema.ts'

const BODY_LIMIT = 1_000_000

/**
 * Local-only recipe writer for `npm run dev`. `apply: 'serve'` keeps this off
 * `vite build`, so GitHub Pages never exposes a write API. The Mac app writes
 * through Tauri instead, using the same `prepareRecipeWrite` checks.
 */
export function recipeEditorPlugin(): Plugin {
  return {
    name: 'recipe-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const route = matchEditorRoute(req.url ?? '', server.config.base)
        if (!route) {
          next()
          return
        }
        void handleEditor(server, req, res, route).catch((error: unknown) => {
          if (res.headersSent) return
          if (error instanceof HttpError) {
            sendJson(res, error.status, { error: error.message })
            return
          }
          const message = error instanceof Error ? error.message : 'Editor request failed'
          console.error('[recipe-editor]', error)
          sendJson(res, 500, { error: message })
        })
      })
    },
  }
}

type EditorRoute = { kind: 'collection' } | { kind: 'recipe'; id: string }

function matchEditorRoute(url: string, base: string): EditorRoute | null {
  let path: string
  try {
    path = decodeURIComponent(url.split('?')[0] ?? '')
  } catch {
    return null
  }
  const prefixes = [`${base}__editor`.replace(/\/{2,}/g, '/'), '/__editor']
  for (const prefix of prefixes) {
    if (path !== prefix && !path.startsWith(`${prefix}/`)) continue
    const rest = path.slice(prefix.length) || '/'
    if (rest === '/recipes') return { kind: 'collection' }
    const one = rest.match(/^\/recipes\/([^/]+)$/)
    if (one?.[1]) return { kind: 'recipe', id: one[1] }
  }
  return null
}

async function handleEditor(
  server: ViteDevServer,
  req: IncomingMessage,
  res: ServerResponse,
  route: EditorRoute,
): Promise<void> {
  const method = req.method ?? 'GET'
  const root = server.config.root
  const recipesDir = resolve(root, 'data/recipes')

  if (route.kind === 'collection' && method === 'POST') {
    const body = await readJson(req)
    const id = writeRecipe(root, recipesDir, null, body)
    invalidateCatalog(server)
    sendJson(res, 200, { id })
    return
  }

  if (route.kind === 'recipe' && method === 'PUT') {
    if (!isSafeRecipeId(route.id)) {
      sendJson(res, 400, { error: 'Invalid recipe id' })
      return
    }
    const file = recipeFile(recipesDir, route.id)
    if (!existsSync(file)) {
      sendJson(res, 404, { error: 'Recipe not found' })
      return
    }
    const body = await readJson(req)
    const id = writeRecipe(root, recipesDir, route.id, body)
    invalidateCatalog(server)
    sendJson(res, 200, { id })
    return
  }

  if (route.kind === 'recipe' && method === 'DELETE') {
    if (!isSafeRecipeId(route.id)) {
      sendJson(res, 400, { error: 'Invalid recipe id' })
      return
    }
    const file = recipeFile(recipesDir, route.id)
    if (!existsSync(file)) {
      sendJson(res, 404, { error: 'Recipe not found' })
      return
    }
    unlinkSync(file)
    invalidateCatalog(server)
    sendJson(res, 200, { ok: true })
    return
  }

  sendJson(res, 405, { error: 'Method not allowed' })
}

function writeRecipe(
  root: string,
  recipesDir: string,
  existingId: string | null,
  body: unknown,
): string {
  const vocab = readVocab(root)
  let prepared
  try {
    prepared = prepareRecipeWrite({
      body,
      existingId,
      idExists: (id) => existsSync(resolve(recipesDir, `${id}.json`)),
      createdAt: existingId != null ? readCreatedAt(recipeFile(recipesDir, existingId)) : null,
      categories: vocab.categories,
      tags: vocab.tags,
    })
  } catch (error) {
    if (error instanceof RecipeWriteError) throw new HttpError(400, error.message)
    throw error
  }

  if (prepared.categories) writeJson(resolve(root, 'data/categories.json'), prepared.categories)
  if (prepared.tags) writeJson(resolve(root, 'data/tags.json'), prepared.tags)

  mkdirSync(recipesDir, { recursive: true })
  writeJson(recipeFile(recipesDir, prepared.id), prepared.recipe)
  console.log(`[recipe-editor] wrote data/recipes/${prepared.id}.json`)
  return prepared.id
}

function readVocab(root: string) {
  const categories = categoriesFileSchema.parse(
    JSON.parse(readFileSync(resolve(root, 'data/categories.json'), 'utf8')),
  )
  const tags = tagsFileSchema.parse(JSON.parse(readFileSync(resolve(root, 'data/tags.json'), 'utf8')))
  return { categories, tags }
}

function recipeFile(recipesDir: string, id: string): string {
  const file = resolve(recipesDir, `${id}.json`)
  const root = resolve(recipesDir)
  if (file !== root && !file.startsWith(root + sep)) {
    throw new HttpError(400, 'Invalid recipe path')
  }
  return file
}

function readCreatedAt(file: string): string {
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as { created_at?: unknown }
    if (typeof raw.created_at === 'string' && raw.created_at.trim()) return raw.created_at
  } catch {
    /* a missing timestamp is filled in below */
  }
  return new Date().toISOString()
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return readBody(req).then((text) => {
    try {
      return JSON.parse(text) as unknown
    } catch {
      throw new HttpError(400, 'Body is not valid JSON')
    }
  })
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > BODY_LIMIT) {
        reject(new HttpError(413, 'Recipe is too large to save'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')))
    req.on('error', () => reject(new HttpError(400, 'Could not read the request')))
  })
}

function writeJson(file: string, value: unknown): void {
  const json = `${JSON.stringify(value, null, 2)}\n`
  const tmp = `${file}.${process.pid}.tmp`
  writeFileSync(tmp, json)
  renameSync(tmp, file)
}

function invalidateCatalog(server: ViteDevServer): void {
  server.moduleGraph.invalidateAll()
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(json)
}

class HttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}
