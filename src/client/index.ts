/** Browser plugin owning the chat-segment share dialog, its controller, and the Header entry. */

import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-commands/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the ui-workspace Context merge (ctx.sessionRowMenu).
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { ChatShareController, type HistoryPage, type HistoryReader } from './controller.ts'
import type { ChatShareDialogInjected } from './Dialog.tsx'
import { ChatShareHeaderAction } from './HeaderAction.tsx'
import { en, NS, zh, type SessionChatShareKey } from './locales.ts'
import { chatShareRowMenuAction } from './row-menu.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    chatShare: ChatShareController
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'session-chat-share': SessionChatShareKey
  }
}

export type { ChatShareEntry, ChatShareState, ShareFormat, ShareMessage } from './controller.ts'

export const inject = ['slots', 'locale', 'connection', 'sessionRowMenu']

/**
 * Wire the `session.history` reader onto the shared API client.
 * @param connection - the shared wire handle.
 * @returns one paged history reader over the sessions domain.
 */
function historyReader(connection: ConnectionHandle): HistoryReader {
  return async (sessionId: SessionId, beforeSeq: number | undefined, maxMessages: number): Promise<HistoryPage> => {
    const response = await connection.api.sessions.history({
      sessionId,
      maxMessages,
      ...(beforeSeq === undefined ? {} : { beforeSeq }),
    })
    const result = response.result
    if (!result.ok) throw new Error(`History read failed: ${result.error.message}`)
    return result.value
  }
}

/**
 * Provide the share controller and mount its dialog into the Session Header.
 * @param ctx - browser context carrying slots, locale, and connection services.
 */
export function apply(ctx: ClientContext): void {
  const controller = new ChatShareController(historyReader(ctx.get('connection') as ConnectionHandle))
  ctx.provide('chatShare', controller)
  ctx.effect(() => async () => { await controller.dispose() }, 'session-chat-share: browser lifecycle')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'session-chat-share: browser dictionaries')
  const menuT = ctx.locale.bind(NS)
  ctx.effect(() => ctx.sessionRowMenu.register(chatShareRowMenuAction(
    sessionId => controller.open(sessionId),
    () => menuT('menu.share'),
  )), 'session-chat-share: row menu action')
  ctx.on('command/executed', (sessionId, commandName, result) => {
    if (commandName === 'share' && result.kind === 'success') void controller.open(sessionId)
  })
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'session-chat-share',
    locale: NS,
    inject: (): ChatShareDialogInjected => ({
      hooks: { chatShare: controller.store },
      open: (sessionId: SessionId) => controller.open(sessionId),
      setRange: (sessionId: SessionId, from: number, to: number) => { controller.setRange(sessionId, from, to) },
      setFormat: (sessionId: SessionId, format: 'markdown' | 'html') => { controller.setFormat(sessionId, format) },
      copy: (sessionId: SessionId) => controller.copy(sessionId),
      download: (sessionId: SessionId) => controller.download(sessionId),
      dismiss: (sessionId: SessionId) => { controller.dismiss(sessionId) },
    }),
  }, ChatShareHeaderAction))
}
