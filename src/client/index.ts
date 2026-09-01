/** Browser plugin owning the chat-segment share dialog, its controller, and the Header entry. */

import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle, HistoryEntry } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-commands/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the ui-workspace Context merge (ctx.sessionRowMenu).
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { toPng } from 'html-to-image'
import {
  ChatShareController,
  type AttachmentReader, type ChildHistoryReader, type HistoryPage, type HistoryReader,
  type MetaReader, type ShareFormat, type SubagentChild, type SubagentReader,
} from './controller.ts'
import type { ChatShareDialogInjected } from './Dialog.tsx'
import { ChatShareHeaderAction } from './HeaderAction.tsx'
import { en, NS, zh, type SessionChatShareKey } from './locales.ts'
import { chatShareRowMenuAction, chatShareSaveTxtMenuAction } from './row-menu.ts'
import type { ShareLabels, ShareMeta } from './render.ts'

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

/** Wire `session.attachment` for HTML image embedding. */
function attachmentReader(connection: ConnectionHandle): AttachmentReader {
  return async (sessionId: SessionId, attachmentId: string) => {
    const response = await connection.api.sessions.attachment({
      sessionId,
      attachmentId: attachmentId as never,
    })
    const result = response.result
    if (!result.ok) throw new Error(`Attachment read failed: ${result.error.message}`)
    return { data: result.value.data, mediaType: result.value.attachment.mediaType }
  }
}

/**
 * Wire the artifact header facts: session title from the list projection and
 * the last logged model route from the history tail's request headers.
 * @param connection - the shared wire handle.
 * @param readHistory - the same paged reader the controller uses.
 * @returns one meta reader (never throws).
 */
function metaReader(connection: ConnectionHandle, readHistory: HistoryReader): MetaReader {
  return async (sessionId: SessionId): Promise<ShareMeta> => {
    const title = await connection.api.sessions.list({}).then((response) => {
      const result = response.result
      if (!result.ok) return undefined
      const row = result.value.items.find(item => String(item.sessionId) === String(sessionId))
      const values = row?.projections?.values as Record<string, unknown> | undefined
      const candidate = values?.['title']
      return typeof candidate === 'string' && candidate !== '' ? candidate : undefined
    }).catch(() => undefined)
    let model: string | undefined
    const tail = await readHistory(sessionId, undefined, 50).catch(() => ({ events: [], hasMore: false }))
    for (let index = tail.events.length - 1; index >= 0; index -= 1) {
      const event = tail.events[index]?.event
      if (event?.type === 'request/header') {
        const config = event.data.header.config
        model = `${config.provider}/${config.model}`
        break
      }
    }
    return {
      ...(title !== undefined ? { title } : {}),
      ...(model !== undefined ? { model } : {}),
    }
  }
}

/** The artifact vocabulary follows the active UI locale at render time. */
function labelsOf(translate: (key: SessionChatShareKey) => string): () => ShareLabels {
  return () => ({
    user: translate('role.user'),
    assistant: translate('role.assistant'),
    tool: translate('role.tool'),
    subagent: translate('role.subagent'),
    sharedFrom: translate('artifact.sharedFrom'),
  })
}

/** Wire `subagents.list` (one tail page per child via `subagents.history`). */
function subagentReaders(connection: ConnectionHandle): {
  subagents: SubagentReader
  childHistory: ChildHistoryReader
} {
  return {
    subagents: async (parentSessionId: SessionId): Promise<SubagentChild[]> => {
      const response = await connection.api.subagents.list({ parentSessionId })
      const result = response.result
      if (!result.ok) throw new Error(`Subagent list failed: ${result.error.message}`)
      return result.value.entries.map((entry) => {
        const child = entry as unknown as { childSessionId?: string; title?: string }
        return {
          childSessionId: child.childSessionId ?? '',
          ...(child.title !== undefined ? { title: child.title } : {}),
        }
      })
    },
    childHistory: async (parentSessionId: SessionId, childSessionId: string): Promise<readonly HistoryEntry[]> => {
      const response = await connection.api.subagents.history({
        parentSessionId,
        childSessionId: childSessionId as never,
        mode: 'continuable' as const,
        maxMessages: 50,
      })
      const result = response.result
      if (!result.ok) throw new Error(`Subagent history failed: ${result.error.message}`)
      return result.value.events
    },
  }
}

/** Run a `/share` command intent produced by the host command handler. */
function runShareIntent(controller: ChatShareController, sessionId: SessionId, resultText: string): void {
  const [verb, flag, count] = resultText.split(':')
  if (verb !== 'share') return
  if (flag === 'txt') {
    const lastN = count === undefined || count === '' ? undefined : Number(count)
    void controller.saveTxt(sessionId, Number.isFinite(lastN) ? lastN : undefined)
  } else {
    void controller.open(sessionId)
  }
}

/**
 * Provide the share controller and mount its dialog into the Session Header.
 * @param ctx - browser context carrying slots, locale, and connection services.
 */
export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as ConnectionHandle
  const readHistory = historyReader(connection)
  const { subagents, childHistory } = subagentReaders(connection)
  const controller = new ChatShareController(
    readHistory,
    undefined,
    undefined,
    attachmentReader(connection),
    metaReader(connection, readHistory),
    labelsOf(ctx.locale.bind(NS)),
    subagents,
    childHistory,
    node => toPng(node, { pixelRatio: 2, cacheBust: true }),
  )
  ctx.provide('chatShare', controller)
  ctx.effect(() => async () => { await controller.dispose() }, 'session-chat-share: browser lifecycle')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'session-chat-share: browser dictionaries')
  const menuT = ctx.locale.bind(NS)
  ctx.effect(() => ctx.sessionRowMenu.register(chatShareRowMenuAction(
    sessionId => controller.open(sessionId),
    () => menuT('menu.share'),
  )), 'session-chat-share: row menu action')
  ctx.effect(() => ctx.sessionRowMenu.register(chatShareSaveTxtMenuAction(
    sessionId => controller.saveTxt(sessionId),
    () => menuT('menu.saveTxt'),
  )), 'session-chat-share: row menu save-txt action')
  ctx.on('command/executed', (sessionId, commandName, result) => {
    if (commandName === 'share' && result.kind === 'success') runShareIntent(controller, sessionId, result.text ?? 'share')
  })
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'session-chat-share',
    locale: NS,
    inject: (): ChatShareDialogInjected => ({
      hooks: { chatShare: controller.store },
      open: (sessionId: SessionId) => controller.open(sessionId),
      setRange: (sessionId: SessionId, from: number, to: number) => { controller.setRange(sessionId, from, to) },
      setFormat: (sessionId: SessionId, format: ShareFormat) => { controller.setFormat(sessionId, format) },
      setRedact: (sessionId: SessionId, redact: boolean) => { controller.setRedact(sessionId, redact) },
      setIncludeTools: (sessionId: SessionId, includeTools: boolean) => { controller.setIncludeTools(sessionId, includeTools) },
      setIncludeSubagents: (sessionId: SessionId, includeSubagents: boolean) => controller.setIncludeSubagents(sessionId, includeSubagents),
      setMultiMode: (sessionId: SessionId, multiMode: boolean) => { controller.setMultiMode(sessionId, multiMode) },
      setSelected: (sessionId: SessionId, indices: readonly number[]) => { controller.setSelected(sessionId, indices) },
      copy: (sessionId: SessionId) => controller.copy(sessionId),
      download: (sessionId: SessionId) => controller.download(sessionId),
      dismiss: (sessionId: SessionId) => { controller.dismiss(sessionId) },
    }),
  }, ChatShareHeaderAction))
}
