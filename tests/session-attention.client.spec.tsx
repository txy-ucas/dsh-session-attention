// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionId, SessionListState, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import { attentionRows, SessionAttention, type SessionAttentionProps } from '../src/client/SessionAttention.tsx'
import { zh } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function sid(value: string): SessionId {
  return value as SessionId
}

function summary(id: string, over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: sid(id),
    displayTitle: id,
    running: false,
    blank: false,
    updatedAt: 0,
    ...over,
  }
}

function state(rows: SessionSummary[], current?: SessionId): SessionListState {
  return {
    ids: rows.map(row => row.id),
    byId: Object.fromEntries(rows.map(row => [row.id, row])) as SessionListState['byId'],
    current,
    phase: 'ready',
    subagentsByParent: {},
    jobsBySession: {},
    currentAddress: undefined,
  }
}

function translate(key: keyof typeof zh, params?: Readonly<Record<string, string | number>>): string {
  let value: string = zh[key]
  for (const [name, replacement] of Object.entries(params ?? {})) {
    value = value.replaceAll(`{${name}}`, String(replacement))
  }
  return value
}

function props(snapshot: SessionListState, openSession = vi.fn()): SessionAttentionProps {
  const useSessions = <T,>(select: (value: SessionListState) => T): T => select(snapshot)
  return { useSessions, openSession, t: translate } as unknown as SessionAttentionProps
}

describe('attentionRows', () => {
  it('excludes the current, blank, and ordinary sessions', () => {
    const rows = attentionRows(state([
      summary('current', { completed: true }),
      summary('blank', { blank: true, completed: true }),
      summary('ordinary'),
      summary('done', { completed: true }),
    ], sid('current')))
    expect(rows.map(row => row.id)).toEqual([sid('done')])
  })

  it('prefers pending interaction over completion and sorts urgency before recency', () => {
    const rows = attentionRows(state([
      summary('done', { completed: true, updatedAt: 99 }),
      summary('approval', { pendingInteraction: 'approval', updatedAt: 30 }),
      summary('plan', { pendingInteraction: 'plan-review', updatedAt: 20 }),
      summary('question-old', { pendingInteraction: 'question', updatedAt: 10 }),
      summary('question-new', { pendingInteraction: 'question', completed: true, updatedAt: 40 }),
    ]))
    expect(rows.map(row => [row.id, row.kind])).toEqual([
      [sid('question-new'), 'question'],
      [sid('question-old'), 'question'],
      [sid('plan'), 'plan-review'],
      [sid('approval'), 'approval'],
      [sid('done'), 'completed'],
    ])
  })
})

describe('SessionAttention', () => {
  it('renders nothing without actionable sessions', () => {
    const { container } = render(<SessionAttention {...props(state([summary('idle')]))} />)
    expect(container.innerHTML).toBe('')
  })

  it('summarizes counts and opens a localized bounded list', () => {
    const rows = Array.from({ length: 10 }, (_, index) => summary(`session-${index}`, {
      completed: index > 1,
      ...(index === 0
        ? { pendingInteraction: 'question' as const }
        : index === 1 ? { pendingInteraction: 'approval' as const } : {}),
      updatedAt: index,
    }))
    render(<SessionAttention {...props(state(rows))} />)
    const trigger = screen.getByRole('button', { name: '会话提醒：2 个待处理，8 个已完成' })
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(within(screen.getByRole('list', { name: '需要关注的会话' })).getAllByRole('listitem')).toHaveLength(8)
    expect(screen.getByText('另有 2 个会话')).toBeDefined()
    expect(screen.getByText('等待回答')).toBeDefined()
    expect(screen.getByText('等待审批')).toBeDefined()
  })

  it('opens a selected session and closes the panel', () => {
    const openSession = vi.fn()
    render(<SessionAttention {...props(state([summary('finished', { completed: true })]), openSession)} />)
    const trigger = screen.getByRole('button', { name: /会话提醒/ })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: /finished/ }))
    expect(openSession).toHaveBeenCalledWith(sid('finished'))
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('contains navigation failures without exposing an exception', () => {
    const openSession = vi.fn(() => { throw new Error('sensitive details') })
    render(<SessionAttention {...props(state([summary('blocked', { pendingInteraction: 'approval' })]), openSession)} />)
    fireEvent.click(screen.getByRole('button', { name: /会话提醒/ }))
    fireEvent.click(screen.getByRole('button', { name: /blocked/ }))
    expect(screen.getByRole('alert').textContent).toBe(zh['navigation.error'])
    expect(screen.queryByText(/sensitive details/)).toBeNull()
  })

  it('closes on Escape and outside pointer input', () => {
    render(<SessionAttention {...props(state([summary('done', { completed: true })]))} />)
    const trigger = screen.getByRole('button', { name: /会话提醒/ })
    fireEvent.click(trigger)
    fireEvent.keyDown(screen.getByRole('heading'), { key: 'Escape' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)

    fireEvent.click(trigger)
    fireEvent.pointerDown(document.body)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })
})
