/** Browser state and actions for sharing a selected range of chat messages. */

import { createSnapshotStore, type SessionId, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { writeClipboard } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HistoryEntry } from '@deepseek-ai/dsh-api-remotes/client'
import {
  redactSensitive, renderShareHtml, renderShareMarkdown, renderShareTxt, shareFileName,
  type ShareLabels, type ShareMeta,
} from './render.ts'

/** Output formats the shared artifact can take. */
export type ShareFormat = 'markdown' | 'html' | 'txt'

/** One session image referenced by a message, resolved lazily for HTML exports. */
export interface ShareImage {
  readonly attachmentId: string
  readonly mediaType: string
  readonly name?: string
}

/** One shareable row on the ordered chat surface. */
export interface ShareMessage {
  /** Durable event seq the row came from. */
  readonly seq: number
  readonly role: 'user' | 'assistant' | 'tool'
  /** Text blocks joined verbatim; `[image]` when the message carried only images. */
  readonly text: string
  /** Unix epoch milliseconds of the durable event. */
  readonly time: number
  /** Image blocks attached to this message (HTML exports embed them). */
  readonly images?: readonly ShareImage[]
}

/** One Session's share-dialog state. */
export interface ChatShareEntry {
  readonly open: boolean
  /** History pages are still being read. */
  readonly loading: boolean
  /** Raw chronological history entries the message list is rebuilt from. */
  readonly raw: readonly HistoryEntry[]
  /** Shareable rows in chronological order (newest last). */
  readonly messages: readonly ShareMessage[]
  /** Inclusive range start index into `messages`. */
  readonly from: number
  /** Inclusive range end index into `messages`. */
  readonly to: number
  readonly format: ShareFormat
  /** Best-effort redaction applied to every rendered artifact. */
  readonly redact: boolean
  /** Tool-call rows included in the list and artifacts. */
  readonly includeTools: boolean
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

/** Resolve one session image to its base64 payload; wired to `session.attachment`. */
export type AttachmentReader = (
  sessionId: SessionId,
  attachmentId: string,
) => Promise<{ data: string; mediaType: string }>

/** Read optional artifact header facts (title, model); wired by the client plugin. */
export type MetaReader = (sessionId: SessionId) => Promise<ShareMeta>

/** The narrow content-block view the share builder reads (type-only, no cross-package value import). */
export interface ShareContentBlock {
  readonly type: string
  readonly text?: string
  readonly attachment?: { readonly attachmentId?: string; readonly mediaType?: string; readonly name?: string }
}

/** Cap on collected share messages, so a huge session cannot stall the dialog. */
export const SHARE_MAX_MESSAGES = 300

/** Cap on tool-call arguments carried into artifacts. */
const TOOL_ARGS_MAX_CHARS = 800

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
 * Split a message's content into share text and image references.
 * @param content - the message's model-facing blocks.
 * @returns the share text ('' when nothing shareable) and the image refs.
 */
export function shareMessageParts(content: readonly ShareContentBlock[]): {
  text: string
  images: ShareImage[]
} {
  const parts: string[] = []
  const images: ShareImage[] = []
  for (const block of content) {
    if (block.type === 'text') parts.push(block.text ?? '')
    else if (block.type === 'image') {
      const attachmentId = block.attachment?.attachmentId
      if (attachmentId !== undefined) {
        images.push({
          attachmentId,
          mediaType: block.attachment?.mediaType ?? 'image/png',
          ...(block.attachment?.name !== undefined ? { name: block.attachment.name } : {}),
        })
      } else {
        parts.push('[image]')
      }
    }
  }
  const text = parts.join('\n')
  return { text: text !== '' ? text : images.length > 0 ? '[image]' : '', images }
}

/**
 * Fold history entries (chronological) into shareable rows: user/assistant
 * messages with their image refs, optional tool-call rows, newest last.
 * Tool results, boundary markers, and surface-replacing compaction copies are
 * excluded; messages with no shareable text are dropped.
 * @param events - history entries in log order.
 * @param options - include tool-call rows when enabled.
 * @returns share rows in the same order.
 */
export function buildShareMessages(
  events: readonly HistoryEntry[],
  options: { includeTools?: boolean } = {},
): ShareMessage[] {
  const messages: ShareMessage[] = []
  for (const entry of events) {
    const event = entry.event
    if (event.type === 'user/message') {
      if (event.surfaceOp !== 'append') continue
      const { text, images } = shareMessageParts(event.data.content)
      if (text === '') continue
      messages.push({
        seq: event.seq, role: 'user', text, time: event.time,
        ...(images.length > 0 ? { images } : {}),
      })
    } else if (event.type === 'assistant/message') {
      if (event.surfaceOp !== 'append') continue
      const { text, images } = shareMessageParts(event.data.message.content)
      if (text === '') continue
      messages.push({
        seq: event.seq, role: 'assistant', text, time: event.time,
        ...(images.length > 0 ? { images } : {}),
      })
    } else if (event.type === 'tool/call' && options.includeTools === true) {
      const args = event.data.arguments
      const bounded = args.length > TOOL_ARGS_MAX_CHARS ? `${args.slice(0, TOOL_ARGS_MAX_CHARS)}\n…` : args
      messages.push({
        seq: event.seq,
        role: 'tool',
        text: `\`${event.data.name}\`\n\n${bounded}`,
        time: event.time,
      })
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
   * @param attachments - optional `session.attachment` reader for HTML image embedding.
   * @param meta - optional artifact header facts reader (title, model).
   * @param labels - optional live artifact vocabulary (follows the UI locale).
   */
  constructor(
    private readonly reader: HistoryReader,
    private readonly clipboard: (text: string) => Promise<boolean> = writeClipboard,
    private readonly save: (blob: Blob, filename: string) => void = saveBlob,
    private readonly attachments?: AttachmentReader,
    private readonly meta?: MetaReader,
    private readonly labels?: () => ShareLabels,
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
   * Download the Session's whole shareable chat as plain text without opening
   * the dialog (the sidebar `...` menu action). Joins an in-flight history
   * load instead of starting a second one.
   * @param sessionId - Session whose chat is saved.
   * @param lastN - when given, save only the newest N messages.
   * @returns after the browser save starts; load failures publish the error.
   */
  saveTxt(sessionId: SessionId, lastN?: number): Promise<void> {
    const existing = this.active.get(sessionId)
    if (existing !== undefined) {
      return existing.done.then(() => this.downloadAllTxt(sessionId, lastN))
    }
    if (this.disposed) return Promise.resolve()
    const abort = new AbortController()
    const done = this.loadAllTxt(sessionId, lastN, abort.signal).finally(() => {
      this.active.delete(sessionId)
    })
    this.active.set(sessionId, { abort, done })
    return done
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
   * @param format - Markdown, HTML, or TXT.
   */
  setFormat(sessionId: SessionId, format: ShareFormat): void {
    const current = this.entry(sessionId)
    if (current === undefined) return
    this.publish(sessionId, { ...current, format, error: null })
  }

  /**
   * Toggle best-effort redaction of the rendered artifacts.
   * @param sessionId - Session owning the dialog.
   * @param redact - mask credential shapes and local paths.
   */
  setRedact(sessionId: SessionId, redact: boolean): void {
    const current = this.entry(sessionId)
    if (current === undefined) return
    this.publish(sessionId, { ...current, redact, error: null })
  }

  /**
   * Toggle tool-call rows in the list and artifacts (rebuilt from raw history).
   * @param sessionId - Session owning the dialog.
   * @param includeTools - show tool-call rows.
   */
  setIncludeTools(sessionId: SessionId, includeTools: boolean): void {
    const current = this.entry(sessionId)
    if (current === undefined) return
    const messages = this.buildRows(current.raw, includeTools)
    const clamp = (index: number): number => Math.max(0, Math.min(messages.length - 1, index))
    const from = clamp(current.from)
    const to = clamp(current.to)
    this.publish(sessionId, { ...current, includeTools, messages, from, to, error: null })
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
    const meta = await this.metaOf(sessionId)
    const text = renderShareMarkdown(this.applyOptions(current, this.range(current)), {
      meta,
      ...(this.labels !== undefined ? { labels: this.labels() } : {}),
    })
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
  async download(sessionId: SessionId): Promise<void> {
    const current = this.entry(sessionId)
    if (current === undefined || current.messages.length === 0 || current.busy !== null) return
    this.publish(sessionId, { ...current, busy: 'download', error: null })
    const selected = this.applyOptions(current, this.range(current))
    try {
      const [meta, images] = await Promise.all([
        this.metaOf(sessionId),
        current.format === 'html' ? this.resolveImages(sessionId, selected) : Promise.resolve(undefined),
      ])
      const options = {
        meta,
        ...(this.labels !== undefined ? { labels: this.labels() } : {}),
        ...(images !== undefined ? { images } : {}),
      }
      const blob = current.format === 'html'
        ? new Blob([renderShareHtml(selected, options)], { type: 'text/html;charset=utf-8' })
        : current.format === 'txt'
          ? new Blob([renderShareTxt(selected, options)], { type: 'text/plain;charset=utf-8' })
          : new Blob([renderShareMarkdown(selected, options)], { type: 'text/markdown;charset=utf-8' })
      this.save(blob, shareFileName(String(sessionId), current.from, current.to, current.format))
      const next = this.store.getSnapshot().bySession[String(sessionId)]
      if (next !== undefined && next.open) this.publish(sessionId, { ...next, busy: null })
    } catch (error: unknown) {
      const next = this.store.getSnapshot().bySession[String(sessionId)]
      if (next !== undefined && next.open) {
        this.publish(sessionId, { ...next, busy: null, error: messageOf(error) || CHAT_SHARE_ERROR.downloadFailed })
      }
    }
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

  /** Build the bounded row list from raw history (newest SHARE_MAX_MESSAGES). */
  private buildRows(raw: readonly HistoryEntry[], includeTools: boolean): ShareMessage[] {
    return buildShareMessages(raw, { includeTools }).slice(-SHARE_MAX_MESSAGES)
  }

  /** Apply the current options to a row list: tool rows filtered, redaction applied. */
  private applyOptions(entry: ChatShareEntry, rows: readonly ShareMessage[]): ShareMessage[] {
    const kept = entry.includeTools ? [...rows] : rows.filter(message => message.role !== 'tool')
    return entry.redact
      ? kept.map(message => ({ ...message, text: redactSensitive(message.text) }))
      : kept
  }

  /** The selected inclusive range of the dialog's message list. */
  private range(entry: ChatShareEntry): readonly ShareMessage[] {
    return entry.messages.slice(entry.from, entry.to + 1)
  }

  private async metaOf(sessionId: SessionId): Promise<ShareMeta> {
    if (this.meta === undefined) return {}
    try {
      return await this.meta(sessionId)
    } catch {
      return {}
    }
  }

  private async resolveImages(
    sessionId: SessionId,
    messages: readonly ShareMessage[],
  ): Promise<Map<string, string> | undefined> {
    if (this.attachments === undefined) return undefined
    const resolved = new Map<string, string>()
    for (const message of messages) {
      for (const image of message.images ?? []) {
        if (resolved.has(image.attachmentId)) continue
        try {
          const { data, mediaType } = await this.attachments(sessionId, image.attachmentId)
          resolved.set(image.attachmentId, `data:${mediaType};base64,${data}`)
        } catch {
          // Keep the placeholder marker for images that fail to resolve.
        }
      }
    }
    return resolved
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
      raw: [],
      messages: [],
      from: 0,
      to: 0,
      format: current?.format ?? 'markdown',
      redact: current?.redact ?? true,
      includeTools: current?.includeTools ?? false,
      busy: null,
      copied: false,
      error: null,
    })
    try {
      const raw = await this.loadRaw(sessionId, signal)
      const messages = this.buildRows(raw, false)
      this.publish(sessionId, {
        open: true,
        loading: false,
        raw,
        messages,
        from: 0,
        to: Math.max(0, messages.length - 1),
        format: 'markdown',
        redact: true,
        includeTools: false,
        busy: null,
        copied: false,
        error: null,
      })
    } catch (error: unknown) {
      if (signal.aborted) return
      const entry = this.entry(sessionId) ?? {
        open: true, loading: false, raw: [], messages: [], from: 0, to: 0, format: 'markdown',
        redact: true, includeTools: false, busy: null, copied: false,
      }
      this.publish(sessionId, { ...entry, loading: false, error: messageOf(error) })
    }
  }

  /** Load the whole shareable chat and hand it to the browser save operation. */
  private async loadAllTxt(sessionId: SessionId, lastN: number | undefined, signal: AbortSignal): Promise<void> {
    const current = this.entry(sessionId)
    if (current !== undefined && current.messages.length > 0) {
      await this.saveTxtBlob(sessionId, current, lastN)
      return
    }
    try {
      const raw = await this.loadRaw(sessionId, signal)
      // Direct saves carry the WHOLE chat, not the dialog's 300-row cap.
      const messages = buildShareMessages(raw, { includeTools: false })
      const entry: ChatShareEntry = {
        open: false, loading: false, raw, messages, from: 0, to: Math.max(0, messages.length - 1),
        format: 'markdown', redact: true, includeTools: false, busy: null, copied: false, error: null,
      }
      await this.saveTxtBlob(sessionId, entry, lastN)
    } catch (error: unknown) {
      if (signal.aborted) return
      const entry = this.entry(sessionId) ?? {
        open: false, loading: false, raw: [], messages: [], from: 0, to: 0, format: 'markdown',
        redact: true, includeTools: false, busy: null, copied: false,
      }
      this.publish(sessionId, { ...entry, error: messageOf(error) })
    }
  }

  /** Save the already-loaded shareable chat as one plain-text file. */
  private async downloadAllTxt(sessionId: SessionId, lastN: number | undefined): Promise<void> {
    const entry = this.entry(sessionId)
    if (entry === undefined || entry.messages.length === 0) return
    await this.saveTxtBlob(sessionId, entry, lastN)
  }

  private async saveTxtBlob(sessionId: SessionId, entry: ChatShareEntry, lastN: number | undefined): Promise<void> {
    const rows = this.applyOptions(entry, entry.messages)
    const slice = lastN === undefined ? rows : rows.slice(-lastN)
    const meta = await this.metaOf(sessionId)
    const blob = new Blob([renderShareTxt(slice, {
      meta,
      ...(this.labels !== undefined ? { labels: this.labels() } : {}),
    })], { type: 'text/plain;charset=utf-8' })
    this.save(blob, shareFileName(String(sessionId), 0, Math.max(0, slice.length - 1), 'txt'))
  }

  private async loadRaw(sessionId: SessionId, signal: AbortSignal): Promise<HistoryEntry[]> {
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
    // page's internal ascending order.
    return pages.reverse().flat()
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
