import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { SessionAttention, type SessionAttentionInjected } from './SessionAttention.tsx'
import { en, NS, type SessionAttentionKey, zh } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Copy owned by the global session attention surface. */
    sessionAttention: SessionAttentionKey
  }
}

/** Services required for session projection, slot composition, and localization. */
export const inject = ['sessions', 'slots', 'locale']

/** Register the localized global attention surface. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'session-attention: dictionaries')
  ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'session-attention',
    order: 20,
    locale: NS,
    inject: (): SessionAttentionInjected => ({
      openSession: sessionId => { ctx.sessions.open(sessionId) },
    }),
  }, SessionAttention)), 'session-attention: overlay')
}
