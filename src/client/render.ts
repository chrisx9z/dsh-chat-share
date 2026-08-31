/** Pure renderers that turn a message range into shareable Markdown or a self-contained HTML page. */

import type { ShareFormat, ShareMessage } from './controller.ts'

/** One fixed timestamp format so shared artifacts read identically on every machine. */
export function formatShareTime(time: number): string {
  return new Date(time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' })
}

/**
 * Render the selected range as Markdown with role headers and timestamps.
 * @param messages - chronological share messages (already range-sliced).
 * @returns one Markdown document.
 */
export function renderShareMarkdown(messages: readonly ShareMessage[]): string {
  const lines: string[] = ['> Shared from DeepSeek Harness', '']
  for (const message of messages) {
    lines.push(`**${roleLabel(message.role)}** · ${formatShareTime(message.time)}`, '', message.text, '')
  }
  return lines.join('\n').trimEnd() + '\n'
}

function roleLabel(role: ShareMessage['role']): string {
  return role === 'user' ? 'User' : 'Assistant'
}

/** Escape text for safe inclusion in the generated HTML page. */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** Split plain text on blank lines into escaped paragraphs, dropping empty splits. */
function paragraphs(plain: string): string[] {
  return plain
    .split(/\n{2,}/)
    .filter(paragraph => paragraph.trim() !== '')
    .map(paragraph => `<p>${escapeHtml(paragraph.trim()).replaceAll('\n', '<br />')}</p>`)
}

/**
 * Convert message text to basic HTML: fenced code blocks become `<pre><code>`
 * (the first fence line is treated as a language hint and dropped), everything
 * else is escaped and split into paragraphs.
 * @param text - message markdown-ish text.
 * @returns escaped HTML fragment.
 */
export function renderRichText(text: string): string {
  const blocks: string[] = []
  let plain = ''
  let index = 0
  for (;;) {
    const fence = text.indexOf('```', index)
    if (fence === -1) {
      plain += text.slice(index)
      break
    }
    plain += text.slice(index, fence)
    const close = text.indexOf('```', fence + 3)
    if (close === -1) {
      plain += text.slice(fence)
      break
    }
    const code = text.slice(fence + 3, close).replace(/^[^\n]*\n/, '').trimEnd()
    if (plain.trim() !== '') {
      blocks.push(...paragraphs(plain))
      plain = ''
    }
    blocks.push(`<pre><code>${escapeHtml(code)}</code></pre>`)
    index = close + 3
  }
  if (plain.trim() !== '') blocks.push(...paragraphs(plain))
  return blocks.join('\n')
}

/**
 * Render the selected range as a self-contained HTML page.
 * @param messages - chronological share messages (already range-sliced).
 * @returns a complete HTML document the recipient can open in any browser.
 */
export function renderShareHtml(messages: readonly ShareMessage[]): string {
  const body = messages
    .map(message => [
      '<section class="message">',
      `<p class="role">${escapeHtml(roleLabel(message.role))} · ${escapeHtml(formatShareTime(message.time))}</p>`,
      renderRichText(message.text),
      '</section>',
    ].join('\n'))
    .join('\n')
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    '<title>Chat segment</title>',
    '<style>',
    ':root { color-scheme: light dark; }',
    'body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; max-width: 820px; margin: 0 auto; padding: 24px 20px 64px; color: #1f2328; line-height: 1.6; }',
    '@media (prefers-color-scheme: dark) { body { color: #e6e6e6; } }',
    '.meta { color: #6b7280; font-size: 13px; }',
    '.message { margin: 20px 0; }',
    '.role { font-weight: 600; }',
    'pre { background: #f6f8fa; padding: 12px; border-radius: 8px; overflow-x: auto; }',
    '@media (prefers-color-scheme: dark) { pre { background: #161b22; } }',
    'code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }',
    'p { margin: 8px 0; }',
    '</style>',
    '</head>',
    '<body>',
    '<main>',
    '<p class="meta">Shared from DeepSeek Harness</p>',
    body,
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

/** One safe browser download filename for the shared artifact. */
export function shareFileName(sessionId: string, from: number, to: number, format: ShareFormat): string {
  const safe = sessionId.replace(/[^A-Za-z0-9_-]/g, '_')
  return `dsh-chat-share-${safe}-${from + 1}-${to + 1}.${format === 'html' ? 'html' : 'md'}`
}
