/** Package invariant companion for `@deepseek-ai/dsh-session-chat-share`. */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-session-chat-share'

export const name = 'session-chat-share-invariant'
export const inject = ['invariants']

/** No runtime invariant: the command registry owns lifecycle pairing and the browser half owns range rendering. */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Host context carrying the invariant registry.
 * @returns the registration disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
