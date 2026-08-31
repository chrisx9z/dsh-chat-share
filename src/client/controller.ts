/** Browser state and actions for sharing a selected range of chat messages. */

import { createSnapshotStore, type SessionId, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HistoryEntry } from '@deepseek-ai/dsh-api-remotes/client'
import { renderShareHtml, renderShareMarkdown, shareFileName } from './render.ts'

/** Output formats the shared artifact can take. */
export type ShareFormat = 'markdown' | 'html'

/** One shareable message on the ordered chat surface. */
export interface ShareMessage {
  /** Durable event seq the message came from. */
  readonly seq: number
  readonly role: 'user' | 'assistant'
  /** Text blocks joined verbatim; `[image]` when the message carried only images. */
  readonly text: string
  /** Unix epoch milliseconds of the durable event. */
  readonly time: number
}

/** One Session's share-dialog state. */
export interface ChatShareEntry {
  readonly open: boolean
  /** History pages are still being read. */
  readonly loading: boolean
  /** Shareable messages in chronological order (newest last). */
  readonly messages: readonly ShareMessage[]
  /** Inclusive range start index into `messages`. */
  readonly from: number
  /** Inclusive range end index into `messages`. */
  readonly to: number
  readonly format: ShareFormat
  /** Which output action is in flight, if any. */
  readonly busy: 'copy' | 'download' | null
  /** Whether the last copy succeeded (the dialog shows a brief check). */
  readonly copied: boolean
  /** Raw error detail; the dialog maps known codes to localized copy. */
  readonly error: string | null
}

/** Share-dialog states keyed by the Session whose Header owns the dialog. */
export interface ChatShareState {
  bySession: Record<string, ChatShareEntry | undefined>
}

/** One `session.history` page as the controller reads it. */
export interface HistoryPage {
  readonly events: readonly HistoryEntry[]
  readonly hasMore: boolean
}

/** Pages the controller reads; wired to `session.history` by the client plugin. */
export type HistoryReader = (
  sessionId: SessionId,
  beforeSeq: number | undefined,
  maxMessages: number,
) => Promise<HistoryPage>

/** The narrow content-block view the share builder reads (type-only, no cross-package value import). */
export interface ShareContentBlock {
  readonly type: string
  readonly text?: string
}

/** Cap on collected share messages, so a huge session cannot stall the dialog. */
export const SHARE_MAX_MESSAGES = 300

/** Messages per `session.history` page. */
const PAGE_MESSAGES = 50

/** Safety cap on history pages read per open. */
const MAX_PAGES = 100

const INITIAL: ChatShareState = { bySession: {} }

/** Known controller error codes the dialog localizes; anything else is shown raw. */
export const CHAT_SHARE_ERROR = {
  copyFailed: 'copy-failed',
  downloadFailed: 'download-failed',
} as const

/**
 * Join a message's content into one share text: text blocks verbatim, and a
 * `[image]` marker for image-only messages.
 * @param content - the message's model-facing blocks.
 * @returns the share text, or '' when the message carries nothing shareable.
 */
export function shareMessageText(content: readonly ShareContentBlock[]): string {
  const parts: string[] = []
  let images = 0
  for (const block of content) {
    if (block.type === 'text') parts.push(block.text ?? '')
    else if (block.type === 'image') images += 1
  }
  const text = parts.join('\n')
  return text !== '' ? text : images > 0 ? '[image]' : ''
}

/**
 * Fold history entries (chronological) into shareable user/assistant messages.
 * Tool results, boundary markers, and surface-replacing compaction copies are
 * excluded; messages with no shareable text are dropped.
 * @param events - history entries in log order.
 * @returns share messages in the same order.
 */
export function buildShareMessages(events: readonly HistoryEntry[]): ShareMessage[] {
  const messages: ShareMessage[] = []
  for (const entry of events) {
    const event = entry.event
    if (event.type === 'user/message') {
      if (event.surfaceOp !== 'append') continue
      const text = shareMessageText(event.data.content)
      if (text === '') continue
      messages.push({ seq: event.seq, role: 'user', text, time: event.time })
    } else if (event.type === 'assistant/message') {
      if (event.surfaceOp !== 'append') continue
      const text = shareMessageText(event.data.message.content)
      if (text === '') continue
      messages.push({ seq: event.seq, role: 'assistant', text, time: event.time })
    }
  }
  return messages
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Hand a Blob to the browser download manager through an object URL. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => { URL.revokeObjectURL(url) }, 10_000)
}

/**
 * Owns one in-flight history load per Session and publishes share-dialog state.
 */
export class ChatShareController {
  /** uSES-safe state source shared by every Session-scoped dialog contribution. */
  readonly store: SnapshotStore<ChatShareState> = createSnapshotStore(INITIAL)

  private readonly active = new Map<SessionId, { readonly abort: AbortController; readonly done: Promise<void> }>()
  private disposed = false

  /**
   * @param reader - paged `session.history` reader (tail page when `beforeSeq` is absent).
   * @param clipboard - clipboard writer returning whether the write landed.
   * @param save - browser save operation for the generated artifact Blob.
   */
  constructor(
    private readonly reader: HistoryReader,
    private readonly clipboard: (text: string) => Promise<boolean> = writeClipboard,
    private readonly save: (blob: Blob, filename: string) => void = saveBlob,
  ) {}

  /**
   * Open (or reopen) one Session's share dialog; concurrent gestures share one load.
   * @param sessionId - Session whose chat segment is shared.
   * @returns after the dialog state settles (open, loaded, or failed).
   */
  open(sessionId: SessionId): Promise<void> {
    const existing = this.active.get(sessionId)
    if (existing !== undefined) return existing.done
    if (this.disposed) return Promise.resolve()
    const abort = new AbortController()
    const done = this.run(sessionId, abort.signal).finally(() => {
      this.active.delete(sessionId)
    })
    this.active.set(sessionId, { abort, done })
    return done
  }

  /**
   * Close one Session's dialog, keeping its loaded messages for the next open.
   * @param sessionId - Session whose modal closes.
   */
  dismiss(sessionId: SessionId): void {
    const current = this.store.getSnapshot().bySession[String(sessionId)]
    if (current === undefined || !current.open) return
    this.publish(sessionId, { ...current, open: false, busy: null })
  }

  /**
   * Select the inclusive message range, clamping and normalizing the bounds.
   * @param sessionId - Session owning the dialog.
   * @param from - range start index.
   * @param to - range end index.
   */
  setRange(sessionId: SessionId, from: number, to: number): void {
    const current = this.entry(sessionId)
    if (current === undefined || current.messages.length === 0) return
    const clamp = (index: number): number =>
      Math.max(0, Math.min(current.messages.length - 1, Math.round(index)))
    const start = clamp(from)
    const end = clamp(to)
    this.publish(sessionId, { ...current, from: Math.min(start, end), to: Math.max(start, end), error: null })
  }

  /**
   * Switch the output format.
   * @param sessionId - Session owning the dialog.
   * @param format - Markdown or HTML.
   */
  setFormat(sessionId: SessionId, format: ShareFormat): void {
    const current = this.entry(sessionId)
    if (current === undefined) return
    this.publish(sessionId, { ...current, format, error: null })
  }

  /**
   * Render the selected range as Markdown and write it to the clipboard.
   * @param sessionId - Session owning the dialog.
   * @returns after the write settles; the dialog shows a check on success.
   */
  async copy(sessionId: SessionId): Promise<void> {
    const current = this.entry(sessionId)
    if (current === undefined || current.messages.length === 0 || current.busy !== null) return
    this.publish(sessionId, { ...current, busy: 'copy', copied: false, error: null })
    const text = renderShareMarkdown(this.range(current))
    const ok = await this.clipboard(text)
    const next = this.store.getSnapshot().bySession[String(sessionId)]
    if (next === undefined || !next.open) return
    this.publish(sessionId, ok
      ? { ...next, busy: null, copied: true }
      : { ...next, busy: null, error: CHAT_SHARE_ERROR.copyFailed })
  }

  /**
   * Render the selected range in the chosen format and download it as a file.
   * @param sessionId - Session owning the dialog.
   * @returns after the browser save starts.
   */
  download(sessionId: SessionId): Promise<void> {
    const current = this.entry(sessionId)
    if (current === undefined || current.messages.length === 0 || current.busy !== null) return Promise.resolve()
    this.publish(sessionId, { ...current, busy: 'download', error: null })
    const selected = this.range(current)
    try {
      const blob = current.format === 'html'
        ? new Blob([renderShareHtml(selected)], { type: 'text/html;charset=utf-8' })
        : new Blob([renderShareMarkdown(selected)], { type: 'text/markdown;charset=utf-8' })
      this.save(blob, shareFileName(String(sessionId), current.from, current.to, current.format))
      const next = this.store.getSnapshot().bySession[String(sessionId)]
      if (next !== undefined && next.open) this.publish(sessionId, { ...next, busy: null })
    } catch (error: unknown) {
      const next = this.store.getSnapshot().bySession[String(sessionId)]
      if (next !== undefined && next.open) {
        this.publish(sessionId, { ...next, busy: null, error: messageOf(error) || CHAT_SHARE_ERROR.downloadFailed })
      }
    }
    return Promise.resolve()
  }

  /**
   * Abort active loads and reach quiescence.
   * @returns after every active operation settles.
   */
  async dispose(): Promise<void> {
    this.disposed = true
    const active = [...this.active.values()]
    for (const operation of active) operation.abort.abort()
    await Promise.allSettled(active.map(operation => operation.done))
  }

  private entry(sessionId: SessionId): ChatShareEntry | undefined {
    return this.store.getSnapshot().bySession[String(sessionId)]
  }

  private range(entry: ChatShareEntry): readonly ShareMessage[] {
    return entry.messages.slice(entry.from, entry.to + 1)
  }

  private async run(sessionId: SessionId, signal: AbortSignal): Promise<void> {
    const current = this.entry(sessionId)
    if (current !== undefined && current.messages.length > 0) {
      this.publish(sessionId, { ...current, open: true, busy: null, copied: false, error: null })
      return
    }
    this.publish(sessionId, {
      open: true,
      loading: true,
      messages: [],
      from: 0,
      to: 0,
      format: current?.format ?? 'markdown',
      busy: null,
      copied: false,
      error: null,
    })
    try {
      const messages = await this.loadMessages(sessionId, signal)
      this.publish(sessionId, {
        open: true,
        loading: false,
        messages,
        from: 0,
        to: Math.max(0, messages.length - 1),
        format: 'markdown',
        busy: null,
        copied: false,
        error: null,
      })
    } catch (error: unknown) {
      if (signal.aborted) return
      const entry = this.entry(sessionId) ?? {
        open: true, loading: false, messages: [], from: 0, to: 0, format: 'markdown', busy: null, copied: false,
      }
      this.publish(sessionId, { ...entry, loading: false, error: messageOf(error) })
    }
  }

  private async loadMessages(sessionId: SessionId, signal: AbortSignal): Promise<ShareMessage[]> {
    const pages: HistoryEntry[][] = []
    let beforeSeq: number | undefined
    let pagesRead = 0
    for (;;) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
      const page = await this.readPage(sessionId, beforeSeq, PAGE_MESSAGES, signal)
      if (page.events.length === 0) break
      pages.push([...page.events])
      if (!page.hasMore) break
      beforeSeq = page.events[0]?.event.seq
      if (beforeSeq === undefined || ++pagesRead >= MAX_PAGES) break
    }
    // Pages arrive newest-first; reverse the page order only, keeping each
    // page's internal ascending order, then cap at the newest messages.
    const chronological = pages.reverse().flat()
    return buildShareMessages(chronological).slice(-SHARE_MAX_MESSAGES)
  }

  private readPage(
    sessionId: SessionId,
    beforeSeq: number | undefined,
    maxMessages: number,
    signal: AbortSignal,
  ): Promise<HistoryPage> {
    const abort = new Promise<HistoryPage>((_resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
      } else {
        signal.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        }, { once: true })
      }
    })
    return Promise.race([this.reader(sessionId, beforeSeq, maxMessages), abort])
  }

  private publish(sessionId: SessionId, entry: ChatShareEntry): void {
    this.store.update((state) => {
      state.bySession = { ...state.bySession, [String(sessionId)]: entry }
    })
  }
}
