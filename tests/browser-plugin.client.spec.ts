import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { apply, inject } from '../src/client/index.ts'
import { apply as applyHost } from '../src/index.ts'

interface LocaleFake {
  dictionaries: Map<string, unknown>
  register: (namespace: string, dictionaries: unknown) => () => void
}

class SlotsFake {
  readonly entries: Array<{ options: { id?: string } }> = []
  private declared = false
  private readonly waiting = new Set<() => () => void>()
  private readonly active = new Map<() => () => void, () => void>()

  constructor(private readonly ctx: Context) {}

  inject(_name: string, callback: () => () => void): () => void {
    const dispose = this.ctx.effect(() => {
      this.waiting.add(callback)
      if (this.declared) this.active.set(callback, callback())
      return () => {
        this.active.get(callback)?.()
        this.active.delete(callback)
        this.waiting.delete(callback)
      }
    })
    return () => { void dispose() }
  }

  register(options: { id?: string }): () => void {
    const entry = { options }
    this.entries.push(entry)
    return () => {
      const index = this.entries.indexOf(entry)
      if (index >= 0) this.entries.splice(index, 1)
    }
  }

  declare(): void {
    this.declared = true
    for (const callback of this.waiting) this.active.set(callback, callback())
  }

  collapse(): void {
    this.declared = false
    for (const dispose of this.active.values()) dispose()
    this.active.clear()
  }
}

function localeFake(): LocaleFake {
  const dictionaries = new Map<string, unknown>()
  return {
    dictionaries,
    register(namespace, value) {
      dictionaries.set(namespace, value)
      return () => { dictionaries.delete(namespace) }
    },
  }
}

describe('browser plugin lifecycle', () => {
  it('declares every service it reads', () => {
    expect(inject).toEqual(['sessions', 'slots', 'locale'])
  })

  it('waits for the overlay declaration and removes all effects on disposal', async () => {
    const ctx = new Context()
    const slots = new SlotsFake(ctx)
    ctx.provide('slots', slots)
    const locale = localeFake()
    const open = vi.fn()
    ctx.provide('sessions', { open })
    ctx.provide('locale', locale)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    expect(slots.entries).toEqual([])
    expect(locale.dictionaries.has('sessionAttention')).toBe(true)

    slots.declare()
    expect(slots.entries.map(entry => entry.options.id)).toEqual(['session-attention'])

    slots.collapse()
    expect(slots.entries).toEqual([])
    slots.declare()
    expect(slots.entries.map(entry => entry.options.id)).toEqual(['session-attention'])

    await fiber.dispose()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(slots.entries).toEqual([])
    expect(locale.dictionaries.has('sessionAttention')).toBe(false)
  })

  it('keeps the host half inert', () => {
    expect(applyHost).not.toThrow()
  })
})
