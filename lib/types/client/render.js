/** Pure renderers: Markdown, plain text, GFM-lite HTML, and best-effort redaction. */
const DEFAULT_LABELS = {
    user: 'User',
    assistant: 'Assistant',
    tool: 'Tool',
    sharedFrom: 'Shared from DeepSeek Harness',
};
/** One fixed timestamp format so shared artifacts read identically on every machine. */
export function formatShareTime(time) {
    return new Date(time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'medium' });
}
function labelsOf(options) {
    return options.labels ?? DEFAULT_LABELS;
}
function roleLabel(role, labels) {
    if (role === 'user')
        return labels.user;
    if (role === 'assistant')
        return labels.assistant;
    return labels.tool;
}
/** The artifact header: title, model, and the shared-from line. */
function headerLines(labels, meta) {
    const lines = [];
    if (meta?.title !== undefined && meta.title !== '')
        lines.push(`# ${meta.title}`, '');
    if (meta?.model !== undefined && meta.model !== '')
        lines.push(`Model: ${meta.model}`, '');
    lines.push(labels.sharedFrom, '');
    return lines;
}
/**
 * Render the selected range as Markdown with role headers and timestamps.
 * @param messages - chronological share messages (already range-sliced).
 * @param options - labels, optional header meta.
 * @returns one Markdown document.
 */
export function renderShareMarkdown(messages, options = {}) {
    const labels = labelsOf(options);
    const lines = headerLines(labels, options.meta);
    for (const message of messages) {
        lines.push(`**${roleLabel(message.role, labels)}** · ${formatShareTime(message.time)}`, '', message.text, '');
    }
    return lines.join('\n').trimEnd() + '\n';
}
/**
 * Render the selected range as plain text with role headers and timestamps.
 * @param messages - chronological share messages (already range-sliced).
 * @param options - labels, optional header meta.
 * @returns one plain-text document (no markup).
 */
export function renderShareTxt(messages, options = {}) {
    const labels = labelsOf(options);
    const lines = headerLines(labels, options.meta).map(line => line.replace(/^# /, ''));
    for (const message of messages) {
        lines.push(`${roleLabel(message.role, labels)} · ${formatShareTime(message.time)}`, '', message.text, '');
    }
    return lines.join('\n').trimEnd() + '\n';
}
/** Escape text for safe inclusion in the generated HTML page. */
export function escapeHtml(text) {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
/** Render inline markdown (code, bold, italic, links) on already-escaped text. */
function inline(escaped) {
    const codes = [];
    const withoutCode = escaped.replace(/`([^`]+)`/g, (_match, code) => {
        codes.push(code);
        return `\u0000${codes.length - 1}\u0000`;
    });
    // Images never hotlink in the artifact: keep only the alt text.
    const noImages = withoutCode.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_match, alt) => `[${alt}]`);
    const withLinks = noImages.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_match, label, href) => `<a href="${href}" rel="noreferrer">${label}</a>`);
    const withStrong = withLinks.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    const withEm = withStrong.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return withEm.replace(/\u0000(\d+)\u0000/g, (_match, index) => `<code>${codes[Number(index)] ?? ''}</code>`);
}
/** One `<li>` from a bullet/ordered line's content. */
function listItem(content) {
    return `<li>${inline(escapeHtml(content.trim()))}</li>`;
}
/** Split raw text into blocks and render GFM-lite HTML. */
export function renderGfmHtml(text) {
    const lines = text.split('\n');
    const blocks = [];
    let plain = [];
    const flushPlain = () => {
        if (plain.length === 0)
            return;
        blocks.push(`<p>${plain.map(line => inline(escapeHtml(line.trim()))).join('<br />')}</p>`);
        plain = [];
    };
    let index = 0;
    while (index < lines.length) {
        const line = lines[index];
        const trimmed = line.trim();
        // Blank lines separate paragraphs.
        if (trimmed === '') {
            flushPlain();
            index += 1;
            continue;
        }
        // Fenced code block.
        const fence = /^```([^\n]*)$/.exec(trimmed);
        if (fence !== null) {
            flushPlain();
            const code = [];
            index += 1;
            while (index < lines.length && !/^```\s*$/.test(lines[index].trim())) {
                code.push(lines[index]);
                index += 1;
            }
            index += 1;
            const lang = fence[1]?.trim() ?? '';
            const cls = lang === '' ? '' : ` class="language-${escapeHtml(lang)}"`;
            blocks.push(`<pre><code${cls}>${escapeHtml(code.join('\n').trimEnd())}</code></pre>`);
            continue;
        }
        // ATX heading.
        const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed);
        if (heading !== null) {
            flushPlain();
            const level = Math.min(6, heading[1]?.length ?? 6);
            blocks.push(`<h${level}>${inline(escapeHtml(heading[2].trim()))}</h${level}>`);
            index += 1;
            continue;
        }
        // Blockquote.
        if (trimmed.startsWith('>')) {
            flushPlain();
            const quote = [];
            while (index < lines.length && lines[index].trim().startsWith('>')) {
                quote.push(lines[index].trim().replace(/^>\s?/, ''));
                index += 1;
            }
            blocks.push(`<blockquote><p>${quote.map(q => inline(escapeHtml(q))).join('<br />')}</p></blockquote>`);
            continue;
        }
        // Unordered list.
        const bullet = /^[-*+]\s+(.+)$/.exec(trimmed);
        if (bullet !== null) {
            flushPlain();
            const items = [listItem(bullet[1])];
            index += 1;
            while (index < lines.length) {
                const next = lines[index].trim();
                const nextBullet = /^[-*+]\s+(.+)$/.exec(next);
                if (nextBullet === null)
                    break;
                items.push(listItem(nextBullet[1]));
                index += 1;
            }
            blocks.push(`<ul>${items.join('')}</ul>`);
            continue;
        }
        // Ordered list.
        const ordered = /^\d+\.\s+(.+)$/.exec(trimmed);
        if (ordered !== null) {
            flushPlain();
            const items = [listItem(ordered[1])];
            index += 1;
            while (index < lines.length) {
                const next = lines[index].trim();
                const nextOrdered = /^\d+\.\s+(.+)$/.exec(next);
                if (nextOrdered === null)
                    break;
                items.push(listItem(nextOrdered[1]));
                index += 1;
            }
            blocks.push(`<ol>${items.join('')}</ol>`);
            continue;
        }
        // GFM table: header row, delimiter row, body rows.
        if (trimmed.includes('|') && index + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[index + 1].trim())
            && lines[index + 1].includes('-')) {
            flushPlain();
            const splitRow = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
            const header = splitRow(trimmed);
            index += 2;
            const body = [];
            while (index < lines.length && lines[index].trim().includes('|')) {
                body.push(splitRow(lines[index].trim()));
                index += 1;
            }
            const cells = (row, tag) => row
                .map(cell => `<${tag}>${inline(escapeHtml(cell))}</${tag}>`).join('');
            blocks.push(`<table><thead><tr>${cells(header, 'th')}</tr></thead>`
                + `<tbody>${body.map(row => `<tr>${cells(row, 'td')}</tr>`).join('')}</tbody></table>`);
            continue;
        }
        plain.push(line);
        index += 1;
    }
    flushPlain();
    return blocks.join('\n');
}
/**
 * Render the selected range as a self-contained HTML page with GFM-lite
 * body rendering; session images embed as data URIs when provided.
 * @param messages - chronological share messages (already range-sliced).
 * @param options - labels, optional header meta, optional resolved images.
 * @returns a complete HTML document the recipient can open in any browser.
 */
export function renderShareHtml(messages, options = {}) {
    const labels = labelsOf(options);
    const body = messages
        .map((message) => {
        const imageTags = (message.images ?? [])
            .map((image) => {
            const dataUri = options.images?.get(image.attachmentId);
            return dataUri === undefined
                ? `<p class="image-marker">[${escapeHtml(image.name ?? labels.sharedFrom)}]</p>`
                : `<p class="image"><img src="${dataUri}" alt="${escapeHtml(image.name ?? '')}" loading="lazy" /></p>`;
        })
            .join('\n');
        return [
            '<section class="message">',
            `<p class="role">${escapeHtml(roleLabel(message.role, labels))} · ${escapeHtml(formatShareTime(message.time))}</p>`,
            message.text !== '' ? renderGfmHtml(message.text) : '',
            imageTags,
            '</section>',
        ].join('\n');
    })
        .join('\n');
    const metaLines = [];
    if (options.meta?.title !== undefined && options.meta.title !== '') {
        metaLines.push(`<h1>${escapeHtml(options.meta.title)}</h1>`);
    }
    if (options.meta?.model !== undefined && options.meta.model !== '') {
        metaLines.push(`<p class="meta">Model: ${escapeHtml(options.meta.model)}</p>`);
    }
    metaLines.push(`<p class="meta">${escapeHtml(labels.sharedFrom)}</p>`);
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
        'h1 { font-size: 22px; }',
        'h2 { font-size: 19px; } h3 { font-size: 17px; } h4, h5, h6 { font-size: 15px; }',
        'pre { background: #f6f8fa; padding: 12px; border-radius: 8px; overflow-x: auto; }',
        '@media (prefers-color-scheme: dark) { pre { background: #161b22; } }',
        'code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; }',
        'table { border-collapse: collapse; margin: 8px 0; }',
        'th, td { border: 1px solid #d0d7de; padding: 4px 10px; font-size: 14px; }',
        'blockquote { margin: 8px 0; padding-left: 12px; border-left: 3px solid #d0d7de; color: #57606a; }',
        'img { max-width: 100%; border-radius: 8px; }',
        'p { margin: 8px 0; }',
        '</style>',
        '</head>',
        '<body>',
        '<main>',
        ...metaLines,
        body,
        '</main>',
        '</body>',
        '</html>',
        '',
    ].join('\n');
}
/** One safe browser download filename for the shared artifact. */
export function shareFileName(sessionId, from, to, format) {
    const safe = sessionId.replace(/[^A-Za-z0-9_-]/g, '_');
    const extension = format === 'html' ? 'html' : format === 'txt' ? 'txt' : 'md';
    return `dsh-chat-share-${safe}-${from + 1}-${to + 1}.${extension}`;
}
/**
 * Best-effort redaction for shared artifacts: masks common credential shapes
 * and local absolute/home paths. Applied to message text before rendering.
 * @param text - raw message text.
 * @returns text with sensitive shapes replaced by `[key]` / `[path]`.
 */
export function redactSensitive(text) {
    return text
        .replace(/\b(sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g, '[key]')
        .replace(/(?:~(?=[/\\]|$)(?:[/\\][^\s"']*)?|(?:\/Users\/[^/\s]+|C:\\Users\\[^\\\s]+)(?:[/\\][^\s"']*)?)/g, '[path]');
}
//# sourceMappingURL=render.js.map