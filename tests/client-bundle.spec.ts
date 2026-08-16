import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

describe('built client bundle', () => {
  it('registers the DSH closure factory and owns its stylesheet', async () => {
    const source = await readFile(resolve(import.meta.dirname, '../lib/client.cjs'), 'utf8')
    expect(source).toMatch(/window\.__ModuleLoader__\.load\(\{\s*id: "dsh-session-attention"/)
    expect(source).toContain('style.dataset.plugin = "dsh-session-attention"')
    expect(source).not.toContain('from "@deepseek-ai/')
  })

  it('does not expose the build checkout in distributable artifacts', async () => {
    const checkout = resolve(import.meta.dirname, '..')
    const home = process.env.HOME
    const artifacts = await Promise.all([
      readFile(resolve(checkout, 'lib/client.cjs'), 'utf8'),
      readFile(resolve(checkout, 'lib/client.cjs.map'), 'utf8'),
    ])
    for (const artifact of artifacts) {
      expect(artifact).not.toContain(checkout)
      if (home !== undefined) expect(artifact).not.toContain(home)
    }
  })

  it('materializes against the platform module table', async () => {
    let handoff: { id: string; factory: (require: (id: string) => unknown) => Record<string, unknown> } | undefined
    const source = await readFile(resolve(import.meta.dirname, '../lib/client.cjs'), 'utf8')
    runInNewContext(source, {
      window: { __ModuleLoader__: { load: (value: typeof handoff) => { handoff = value } } },
    })
    expect(handoff?.id).toBe('dsh-session-attention')
    const required: string[] = []
    const exports = handoff?.factory((id) => {
      required.push(id)
      if (id === 'react') return awaitImportReact
      if (id === 'react/jsx-runtime') return jsxRuntimeFake
      if (id === '@deepseek-ai/dsh-client-runtime/client') return {}
      throw new Error(`unexpected require: ${id}`)
    })
    expect(required).toEqual(['react/jsx-runtime', 'react'])
    expect(exports?.inject).toEqual(['sessions', 'slots', 'locale'])
    expect(exports?.apply).toBeTypeOf('function')
  })
})

const awaitImportReact = {
  useEffect: vi.fn(),
  useMemo: vi.fn(),
  useRef: vi.fn(),
  useState: vi.fn(),
}
const jsxRuntimeFake = { jsx: vi.fn(), jsxs: vi.fn() }
