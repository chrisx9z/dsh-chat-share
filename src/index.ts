/** Web Chat-segment share command over the browser dialog owned by the client half. */

import { mkdir, writeFile } from 'node:fs/promises'
import type { Context } from '@deepseek-ai/cordis'
import type { CommandResult } from '@deepseek-ai/dsh-commands'

export const name = 'session-chat-share'
export const inject = ['commands']

/** Plugin config: `autoSaveDir` enables writing one TXT per session after every turn. */
export interface SessionChatShareConfig {
  autoSaveDir?: string
}

/** The narrow host-side event view used by the auto-save renderer. */
interface HostEvent {
  type: string
  seq: number
  time: number
  surfaceOp?: unknown
  data: {
    content?: readonly { type?: string; text?: string }[]
    message?: { content?: readonly { type?: string; text?: string }[] }
  }
}

/** The narrow host-side session view (the `session/event` listener's first argument). */
interface HostSession {
  id: string
  events: readonly unknown[]
}

/**
 * Parse a `/share` invocation into the intent token the browser observes.
 * Accepts: nothing (open the dialog), `txt`, `last <n>`, and combinations.
 * @param raw - trimmed command input.
 * @returns the command result; success text is `share[:txt[:<n>]]`.
 */
export function parseShareInvocation(raw: string): CommandResult {
  const input = raw.trim()
  if (input === '') return { kind: 'success', text: 'share' }
  const tokens = input.split(/\s+/)
  let txt = false
  let lastN: number | undefined
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token === 'txt') {
      txt = true
    } else if (token === 'last') {
      const count = Number(tokens[index + 1])
      if (!Number.isInteger(count) || count <= 0) {
        return { kind: 'error', text: '/share last requires a positive message count, e.g. `/share last 10`.' }
      }
      lastN = count
      index += 1
    } else {
      return {
        kind: 'error',
        text: '/share accepts: nothing (opens the dialog), `txt` (save the whole chat as .txt), '
          + '`last <n>` (save the newest n messages as .txt), or `txt last <n>`.',
      }
    }
  }
  const count = lastN === undefined ? '' : String(lastN)
  return txt || lastN !== undefined
    ? { kind: 'success', text: `share:txt${count === '' ? '' : `:${count}`}` }
    : { kind: 'success', text: 'share' }
}

/** Join one message's text blocks for the auto-save TXT renderer. */
function hostMessageText(content: readonly { type?: string; text?: string }[] | undefined): string {
  const parts: string[] = []
  let images = 0
  for (const block of content ?? []) {
    if (block.type === 'text') parts.push(block.text ?? '')
    else if (block.type === 'image') images += 1
  }
  const text = parts.join('\n')
  return text !== '' ? text : images > 0 ? '[image]' : ''
}

/** Render the whole shareable chat as plain text (English vocabulary). */
export function hostRenderTxt(events: readonly unknown[]): string {
  const lines: string[] = ['Shared from DeepSeek Harness', '']
  for (const raw of events) {
    const event = raw as HostEvent
    if (event.surfaceOp !== 'append') continue
    let role: string | undefined
    let text: string
    if (event.type === 'user/message') {
      role = 'User'
      text = hostMessageText(event.data.content)
    } else if (event.type === 'assistant/message') {
      role = 'Assistant'
      text = hostMessageText(event.data.message?.content)
    } else {
      continue
    }
    if (text === '') continue
    lines.push(`${role} · ${new Date(event.time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })}`, '', text, '')
  }
  return lines.join('\n').trimEnd() + '\n'
}

/**
 * Register the Web-only `/share` command that the browser share dialog
 * observes, and — when `autoSaveDir` is configured — write one plain-text
 * file per Session after every completed turn.
 * @param ctx - Host context carrying the human-command registry.
 * @param config - row configuration (e.g. `{ autoSaveDir: 'C:/shares' }`).
 */
export function apply(ctx: Context, config: SessionChatShareConfig = {}): void {
  ctx.effect(() => ctx.commands.register({
    name: 'share',
    description: 'Share a segment of this chat as Markdown, HTML, or plain text',
    handler: invocation => Promise.resolve(parseShareInvocation(invocation.rawInput)),
  }), 'session-chat-share: command')

  if (config.autoSaveDir !== undefined && config.autoSaveDir.trim() !== '') {
    const dir = config.autoSaveDir.trim()
    ctx.on('session/event', (session: HostSession, event: unknown) => {
      if ((event as HostEvent).type !== 'turn/end') return
      const text = hostRenderTxt(session.events)
      mkdir(dir, { recursive: true })
        .then(() => writeFile(`${dir}/${session.id}.txt`, text, 'utf8'))
        .catch((error: unknown) => {
          ctx.logger.warn(`session-chat-share: auto-save failed: ${error instanceof Error ? error.message : String(error)}`)
        })
    })
  }
}
