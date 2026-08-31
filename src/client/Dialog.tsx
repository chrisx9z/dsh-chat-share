import { useEffect, useState } from 'react'
import type { ObservableSnapshot, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { Button, IconCheckOutline16, IconCopyOutline16, IconDownloadOutline16, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { CHAT_SHARE_ERROR, type ChatShareState, type ShareFormat } from './controller.ts'
import { NS, type SessionChatShareKey } from './locales.ts'
import { formatShareTime, renderShareHtml, renderShareMarkdown } from './render.ts'
import css from './Dialog.module.css'

/** Preview character ceiling inside the dialog; the shared artifact itself is never truncated. */
const PREVIEW_MAX_CHARS = 6000

/** Browser operations and state injected into the Session Header contribution. */
export interface ChatShareDialogInjected {
  hooks: { chatShare: ObservableSnapshot<ChatShareState> }
  open: (sessionId: SessionId) => Promise<void>
  setRange: (sessionId: SessionId, from: number, to: number) => void
  setFormat: (sessionId: SessionId, format: ShareFormat) => void
  copy: (sessionId: SessionId) => Promise<void>
  download: (sessionId: SessionId) => Promise<void>
  dismiss: (sessionId: SessionId) => void
}

export type ChatShareDialogProps =
  PropsRuntime<'conversation.session.header.utilities'>
  & PropsLocale<typeof NS>
  & InjectFace<ChatShareDialogInjected>

/** One line of the range selector and message list. */
function optionLabel(index: number, role: string, time: number, text: string): string {
  const firstLine = text.split('\n')[0]?.trim() ?? ''
  const preview = firstLine.length > 48 ? `${firstLine.slice(0, 48)}…` : firstLine
  return `#${index + 1} ${role} · ${formatShareTime(time)} · ${preview}`
}

/** Map a controller error to localized copy; reader failures keep their raw detail. */
function errorMessage(error: string | null, t: (key: SessionChatShareKey) => string): string | null {
  if (error === null) return null
  if (error === CHAT_SHARE_ERROR.copyFailed) return t('dialog.copyFailed')
  if (error === CHAT_SHARE_ERROR.downloadFailed) return t('dialog.downloadFailed')
  if (error === '') return t('dialog.historyFailed')
  return `${t('dialog.historyFailed')} ${error}`
}

/**
 * Modal shared by the Session Header button and this browser's `/share` command.
 * @param props - Session runtime, bound controller state, actions, and localized copy.
 * @returns the modal portal contribution.
 */
export function ChatShareDialog({
  sessionId, useChatShare, setRange, setFormat, copy, download, dismiss, t,
}: ChatShareDialogProps) {
  const entry = useChatShare(state => state.bySession[String(sessionId)])
  const open = entry?.open === true
  const loading = entry?.loading === true
  const messages = entry?.messages ?? []
  const from = entry?.from ?? 0
  const to = entry?.to ?? 0
  const format = entry?.format ?? 'markdown'
  const busy = entry?.busy ?? null
  const copied = entry?.copied === true
  const error = entry?.error ?? null

  const [flashCopied, setFlashCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    setFlashCopied(true)
    const timer = window.setTimeout(() => { setFlashCopied(false) }, 1500)
    return () => { window.clearTimeout(timer) }
  }, [copied])

  const roleLabel = (role: 'user' | 'assistant'): string => t(role === 'user' ? 'role.user' : 'role.assistant')

  const errorText = errorMessage(error, t)

  const clickMessage = (index: number): void => {
    if (index < from) setRange(sessionId, index, to)
    else if (index > to) setRange(sessionId, from, index)
    else setRange(sessionId, index, index)
  }

  const range = messages.slice(from, to + 1)
  const rendered = format === 'html' ? renderShareHtml(range) : renderShareMarkdown(range)
  const preview = rendered.length > PREVIEW_MAX_CHARS
    ? `${rendered.slice(0, PREVIEW_MAX_CHARS)}\n${t('dialog.previewTruncated')}`
    : rendered

  const actionsDisabled = busy !== null || messages.length === 0

  return (
    <Modal
      open={open}
      onClose={() => { dismiss(sessionId) }}
      title={t('dialog.title')}
      description={t('dialog.description')}
      closeLabel={t('dialog.close')}
      contentClassName={css.content ?? ''}
      footer={(
        <>
          <Button
            variant="primary"
            icon={flashCopied ? <IconCheckOutline16 /> : <IconCopyOutline16 />}
            disabled={actionsDisabled}
            onClick={() => { void copy(sessionId) }}
          >
            {flashCopied ? t('dialog.copied') : t('dialog.copy')}
          </Button>
          <Button
            variant="ghost"
            icon={<IconDownloadOutline16 />}
            disabled={actionsDisabled}
            onClick={() => { void download(sessionId) }}
          >
            {t('dialog.download')}
          </Button>
          <Button variant="ghost" onClick={() => { dismiss(sessionId) }}>{t('dialog.close')}</Button>
        </>
      )}
    >
      {loading && <p className={css.status}>{t('dialog.loading')}</p>}
      {!loading && errorText !== null && <p className={css.status}>{errorText}</p>}
      {!loading && errorText === null && messages.length === 0 && <p className={css.status}>{t('dialog.empty')}</p>}
      {!loading && errorText === null && messages.length > 0 && (
        <>
          <div className={css.controls}>
            <label className={css.rangeControl}>
              <span>{t('dialog.rangeFrom')}</span>
              <select
                value={from}
                disabled={busy !== null}
                onChange={(event) => { setRange(sessionId, Number(event.target.value), to) }}
              >
                {messages.map((message, index) => (
                  <option key={message.seq} value={index}>
                    {optionLabel(index, roleLabel(message.role), message.time, message.text)}
                  </option>
                ))}
              </select>
            </label>
            <label className={css.rangeControl}>
              <span>{t('dialog.rangeTo')}</span>
              <select
                value={to}
                disabled={busy !== null}
                onChange={(event) => { setRange(sessionId, from, Number(event.target.value)) }}
              >
                {messages.map((message, index) => (
                  <option key={message.seq} value={index}>
                    {optionLabel(index, roleLabel(message.role), message.time, message.text)}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className={css.formatControl} disabled={busy !== null}>
              <legend>{t('dialog.format')}</legend>
              <label>
                <input
                  type="radio"
                  name={`chat-share-format-${String(sessionId)}`}
                  value="markdown"
                  checked={format === 'markdown'}
                  onChange={() => { setFormat(sessionId, 'markdown') }}
                />
                {t('dialog.format.markdown')}
              </label>
              <label>
                <input
                  type="radio"
                  name={`chat-share-format-${String(sessionId)}`}
                  value="html"
                  checked={format === 'html'}
                  onChange={() => { setFormat(sessionId, 'html') }}
                />
                {t('dialog.format.html')}
              </label>
            </fieldset>
          </div>
          <p className={css.messagesHeading}>{t('dialog.messages')}</p>
          <ol className={css.list}>
            {messages.map((message, index) => {
              const selected = index >= from && index <= to
              return (
                <li key={message.seq}>
                  <button
                    type="button"
                    className={selected ? `${css.row} ${css.rowSelected}` : css.row}
                    aria-pressed={selected}
                    onClick={() => { clickMessage(index) }}
                  >
                    <span className={css.rowIndex}>#{index + 1}</span>
                    <span className={css.rowRole}>{roleLabel(message.role)}</span>
                    <span className={css.rowTime}>{formatShareTime(message.time)}</span>
                    <span className={css.rowText}>{message.text.split('\n')[0]}</span>
                  </button>
                </li>
              )
            })}
          </ol>
          <details className={css.preview}>
            <summary>{t('dialog.preview')}</summary>
            <pre className={css.previewBody}>{preview}</pre>
          </details>
        </>
      )}
    </Modal>
  )
}
