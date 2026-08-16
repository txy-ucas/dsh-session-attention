import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('repository portability', () => {
  it('keeps local machine paths out of public documentation', async () => {
    const checkout = resolve(import.meta.dirname, '..')
    const readme = await readFile(resolve(checkout, 'README.md'), 'utf8')
    expect(readme).not.toContain(checkout)
    if (process.env.HOME !== undefined) expect(readme).not.toContain(process.env.HOME)
    expect(readme).not.toMatch(/\/Users\/[^/]+\//)
  })
})
