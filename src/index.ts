/** Web Chat-segment share command over the browser dialog owned by the client half. */

import type { Context } from '@deepseek-ai/cordis'
import type { CommandResult } from '@deepseek-ai/dsh-commands'

export const name = 'session-chat-share'
export const inject = ['commands']

const REQUESTED: CommandResult = {
  kind: 'success',
  text: 'Chat segment share dialog requested.',
}

/**
 * Register the Web-only `/share` command that the browser share dialog observes.
 * @param ctx - Host context carrying the human-command registry.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.commands.register({
    name: 'share',
    description: 'Share a segment of this chat as Markdown or HTML',
    handler: invocation => Promise.resolve(invocation.rawInput.trim() === ''
      ? REQUESTED
      : { kind: 'error', text: 'The Web /share command opens the share dialog and does not accept arguments.' }),
  }), 'session-chat-share: command')
}
