import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { SessionId, SessionListState, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { NS } from './locales.ts'
import css from './SessionAttention.module.css'

/** Navigation callbacks supplied by the browser plugin's apply closure. */
export interface SessionAttentionInjected {
  /** Select a session through the runtime service. */
  openSession: (sessionId: SessionId) => void
}

/** Complete props delivered to the global attention overlay. */
export type SessionAttentionProps =
  PropsRuntime<'shell.overlay'> & PropsLocale<typeof NS> & SessionAttentionInjected

type AttentionKind = NonNullable<SessionSummary['pendingInteraction']> | 'completed'

interface AttentionRow {
  readonly id: SessionId
  readonly title: string
  readonly kind: AttentionKind
  readonly updatedAt: number
}

const MAX_VISIBLE_ROWS = 8
const PRIORITY: Readonly<Record<AttentionKind, number>> = {
  question: 0,
  'plan-review': 1,
  approval: 2,
  completed: 3,
}

/** Build the bounded visual projection without retaining another session-state copy. */
export function attentionRows(state: SessionListState): AttentionRow[] {
  const rows: AttentionRow[] = []
  for (const id of state.ids) {
    const session = state.byId[id]
    if (session === undefined || id === state.current || session.blank) continue
    const kind = session.pendingInteraction ?? (session.completed === true ? 'completed' : undefined)
    if (kind === undefined) continue
    rows.push({ id, title: session.displayTitle, kind, updatedAt: session.updatedAt })
  }
  rows.sort((left, right) => PRIORITY[left.kind] - PRIORITY[right.kind]
    || right.updatedAt - left.updatedAt
    || String(left.id).localeCompare(String(right.id)))
  return rows
}

/** Global attention pill and its bounded session switcher. */
export function SessionAttention({ useSessions, openSession, t }: SessionAttentionProps) {
  const sessions = useSessions(state => state)
  const rows = useMemo(() => attentionRows(sessions), [sessions])
  const [open, setOpen] = useState(false)
  const [navigationError, setNavigationError] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const pending = rows.filter(row => row.kind !== 'completed').length
  const completed = rows.length - pending
  const visible = rows.slice(0, MAX_VISIBLE_ROWS)
  const omitted = rows.length - visible.length

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent): void => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => { document.removeEventListener('pointerdown', closeOutside) }
  }, [open])

  useEffect(() => {
    if (rows.length === 0 && open) setOpen(false)
  }, [open, rows.length])

  if (rows.length === 0) return null

  const closeWithFocus = (): void => {
    setOpen(false)
    triggerRef.current?.focus()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape' || !open) return
    event.preventDefault()
    closeWithFocus()
  }

  return (
    <div ref={rootRef} className={css.root} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={css.trigger}
        aria-expanded={open}
        aria-label={t('trigger.label', { pending, completed })}
        onClick={() => {
          setNavigationError(false)
          setOpen(value => !value)
        }}
      >
        <svg className={css.radar} viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 4v3M20 12h-3M12 20v-3M4 12h3" />
        </svg>
        <span>{t('trigger.short', { count: rows.length })}</span>
        {pending > 0 ? <span className={`${css.count} ${css.pendingCount}`}>{pending}</span> : null}
        {completed > 0 ? <span className={`${css.count} ${css.completedCount}`}>{completed}</span> : null}
      </button>
      {open
        ? (
          <section className={css.panel} aria-labelledby="session-attention-title">
            <header className={css.header}>
              <div>
                <h2 id="session-attention-title">{t('panel.title')}</h2>
                <p>{t('panel.description')}</p>
              </div>
              <button type="button" className={css.close} aria-label={t('panel.close')} onClick={closeWithFocus}>×</button>
            </header>
            {navigationError ? <p className={css.error} role="alert">{t('navigation.error')}</p> : null}
            <ul className={css.list} aria-label={t('panel.list')}>
              {visible.map(row => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={css.row}
                    onClick={() => {
                      try {
                        openSession(row.id)
                        setOpen(false)
                        setNavigationError(false)
                      } catch {
                        setNavigationError(true)
                      }
                    }}
                  >
                    <span className={`${css.dot} ${row.kind === 'completed' ? css.doneDot : css.waitDot}`} />
                    <span className={css.rowText}>
                      <strong title={row.title}>{row.title}</strong>
                      <span>{t(`status.${row.kind}`)}</span>
                    </span>
                    <svg className={css.arrow} viewBox="0 0 20 20" aria-hidden="true">
                      <path d="m7 4 6 6-6 6" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
            {omitted > 0 ? <p className={css.more}>{t('panel.more', { count: omitted })}</p> : null}
          </section>
        )
        : null}
    </div>
  )
}
