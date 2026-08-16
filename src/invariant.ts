import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = 'dsh-session-attention'

/** Cordis companion plugin name. */
export const name = 'session-attention-invariant'
/** Service required before reserving package invariant ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: this browser-only package projects the existing
 * session list into one slot and owns no cross-plugin mutable state.
 */
const install: InvariantInstaller = () => {}

/** Register this package's invariant ownership. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
